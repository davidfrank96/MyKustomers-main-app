import "server-only";
import { headers } from "next/headers";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { hashRateLimitIdentity } from "@/features/confirmation-links/rate-limit-keys";

type ConfirmationRateLimitAction = "lookup" | "confirm";

const rateLimitConfig: Record<
  ConfirmationRateLimitAction,
  { maxRequests: number; windowSeconds: number; blockSeconds: number }
> = {
  lookup: { maxRequests: 60, windowSeconds: 60, blockSeconds: 60 },
  confirm: { maxRequests: 10, windowSeconds: 60, blockSeconds: 120 },
};

export async function confirmationRateLimitBucket(action: ConfirmationRateLimitAction) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = requestHeaders.get("x-real-ip")?.trim();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 80) ?? "unknown";
  const identity = `${action}:${forwardedFor || realIp || "unknown"}:${userAgent}`;

  return hashRateLimitIdentity(identity);
}

export async function consumeConfirmationRateLimit(
  action: ConfirmationRateLimitAction,
  bucketKey: string,
) {
  if (!canUseServiceRoleClient()) {
    return false;
  }

  const config = rateLimitConfig[action];
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("consume_confirmation_rate_limit", {
    p_bucket_key: bucketKey,
    p_action: action,
    p_max_requests: config.maxRequests,
    p_window_seconds: config.windowSeconds,
    p_block_seconds: config.blockSeconds,
  });

  if (error) {
    return false;
  }

  return data === true;
}
