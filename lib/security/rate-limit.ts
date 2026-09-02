import "server-only";

import { randomInt } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { assertSupabaseServiceRoleEnv } from "@/lib/config/server-env";
import {
  canUseServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/admin";
import {
  deriveRateLimitBucketKey,
  parseTrustedForwardedFor,
} from "@/lib/security/rate-limit-key";

export type RateLimitPolicy = {
  maxRequests: number;
  windowSeconds: number;
  blockSeconds: number;
};

export type RateLimitResult = {
  status: "allowed" | "limited" | "unavailable";
  remainingRequests: number | null;
  retryAfterSeconds: number;
  resetAt: string | null;
};

export type RateLimitLayer = {
  action: string;
  keyParts: readonly string[];
  policy: RateLimitPolicy;
};

const UNAVAILABLE_RESULT: RateLimitResult = {
  status: "unavailable",
  remainingRequests: null,
  retryAfterSeconds: 0,
  resetAt: null,
};

function safeTelemetryAction(action: string) {
  return /^[a-z0-9_.-]{1,80}$/i.test(action) ? action : "invalid";
}

function captureStorageFailure(action: string, operation: "consume" | "clear" | "cleanup") {
  Sentry.captureMessage("Application rate-limit storage unavailable", {
    level: "warning",
    tags: {
      rate_limit_action: safeTelemetryAction(action),
      rate_limit_operation: operation,
    },
  });
}

function bucketKey(action: string, keyParts: readonly string[]) {
  return deriveRateLimitBucketKey(
    assertSupabaseServiceRoleEnv(),
    action,
    keyParts,
  );
}

async function maybeCleanupRateLimitBuckets() {
  if (randomInt(128) !== 0 || !canUseServiceRoleClient()) return;

  try {
    const { error } = await createServiceRoleClient().rpc(
      "cleanup_application_rate_limits",
      {
        p_retention_seconds: 172_800,
        p_batch_size: 500,
      },
    );

    if (error) captureStorageFailure("aggregate", "cleanup");
  } catch {
    captureStorageFailure("aggregate", "cleanup");
  }
}

export async function getTrustedRequestSource() {
  const requestHeaders = await headers();
  return parseTrustedForwardedFor(requestHeaders.get("x-forwarded-for")) ?? "unavailable";
}

export async function consumeApplicationRateLimit({
  action,
  keyParts,
  policy,
}: RateLimitLayer): Promise<RateLimitResult> {
  if (!canUseServiceRoleClient()) {
    captureStorageFailure(action, "consume");
    return UNAVAILABLE_RESULT;
  }

  try {
    const { data, error } = await createServiceRoleClient().rpc(
      "consume_application_rate_limit",
      {
        p_bucket_key: bucketKey(action, keyParts),
        p_action: action,
        p_max_requests: policy.maxRequests,
        p_window_seconds: policy.windowSeconds,
        p_block_seconds: policy.blockSeconds,
      },
    );
    const result = data?.[0];

    if (error || !result) {
      captureStorageFailure(action, "consume");
      return UNAVAILABLE_RESULT;
    }

    void maybeCleanupRateLimitBuckets();

    return {
      status: result.allowed ? "allowed" : "limited",
      remainingRequests: result.remaining_requests,
      retryAfterSeconds: result.retry_after_seconds,
      resetAt: result.reset_at,
    };
  } catch {
    captureStorageFailure(action, "consume");
    return UNAVAILABLE_RESULT;
  }
}

export async function consumeRateLimitLayers(
  layers: readonly RateLimitLayer[],
): Promise<RateLimitResult> {
  const results = await Promise.all(layers.map(consumeApplicationRateLimit));
  const limited = results.filter((result) => result.status === "limited");

  if (limited.length > 0) {
    return {
      status: "limited",
      remainingRequests: 0,
      retryAfterSeconds: Math.max(
        1,
        ...limited.map((result) => result.retryAfterSeconds),
      ),
      resetAt:
        limited
          .map((result) => result.resetAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null,
    };
  }

  if (results.some((result) => result.status === "unavailable")) {
    return UNAVAILABLE_RESULT;
  }

  return {
    status: "allowed",
    remainingRequests: Math.min(
      ...results.map((result) => result.remainingRequests ?? Number.MAX_SAFE_INTEGER),
    ),
    retryAfterSeconds: 0,
    resetAt:
      results
        .map((result) => result.resetAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
  };
}

export async function clearApplicationRateLimit({
  action,
  keyParts,
}: Pick<RateLimitLayer, "action" | "keyParts">) {
  if (!canUseServiceRoleClient()) return false;

  try {
    const { data, error } = await createServiceRoleClient().rpc(
      "clear_application_rate_limit",
      {
        p_bucket_key: bucketKey(action, keyParts),
        p_action: action,
      },
    );

    if (error) {
      captureStorageFailure(action, "clear");
      return false;
    }

    return data === true;
  } catch {
    captureStorageFailure(action, "clear");
    return false;
  }
}

export type OutboundMessageKind =
  | "confirmation_email"
  | "booking_amendment"
  | "booking_addon"
  | "booking_reschedule";

export function consumeOutboundMessageRateLimit(input: {
  kind: OutboundMessageKind;
  resourceId: string;
  userId: string;
  businessId: string;
}) {
  return consumeRateLimitLayers([
    {
      action: `${input.kind}_resource`,
      keyParts: ["resource", input.resourceId],
      policy: { maxRequests: 3, windowSeconds: 900, blockSeconds: 900 },
    },
    {
      action: `${input.kind}_actor`,
      keyParts: ["actor", input.userId, "business", input.businessId],
      policy: { maxRequests: 30, windowSeconds: 3_600, blockSeconds: 3_600 },
    },
  ]);
}
