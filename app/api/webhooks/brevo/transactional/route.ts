import { createHash, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  BREVO_WEBHOOK_MAX_BODY_BYTES,
  isUnsupportedBrevoEvent,
  parseBrevoTransactionalPayload,
  shouldRetryUnmatchedBrevoEvent,
} from "@/features/provider-delivery/brevo";
import { serverEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, result: string, headers?: HeadersInit) {
  return NextResponse.json(
    { result },
    { status, headers: { ...responseHeaders, ...headers } },
  );
}

function isAuthorized(request: Request) {
  const secret = serverEnv.BREVO_WEBHOOK_SECRET;
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!secret || secret.length < 32 || !match) return false;

  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(match[1]!).digest();
  return timingSafeEqual(expected, supplied);
}

async function readBoundedJson(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > BREVO_WEBHOOK_MAX_BODY_BYTES) {
    return { status: "oversized" as const };
  }

  const reader = request.body?.getReader();
  if (!reader) return { status: "malformed" as const };
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > BREVO_WEBHOOK_MAX_BODY_BYTES) {
      await reader.cancel();
      return { status: "oversized" as const };
    }
    chunks.push(value);
  }

  try {
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      status: "ok" as const,
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    };
  } catch {
    return { status: "malformed" as const };
  }
}

function capturePersistenceFailure(eventType: string) {
  Sentry.captureMessage("Brevo webhook evidence persistence unavailable", {
    level: "error",
    tags: {
      provider: "brevo",
      event_category: eventType,
      failure_category: "persistence_unavailable",
    },
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse(401, "unauthorized");
  }

  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    return jsonResponse(415, "unsupported_media_type");
  }

  const body = await readBoundedJson(request);
  if (body.status === "oversized") return jsonResponse(413, "payload_too_large");
  if (body.status !== "ok") return jsonResponse(400, "malformed_payload");

  const event = parseBrevoTransactionalPayload(body.value);
  if (isUnsupportedBrevoEvent(body.value)) {
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (!event) return jsonResponse(400, "malformed_payload");

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("ingest_brevo_transactional_event", {
      p_message_id: event.messageId,
      p_event_type: event.normalizedEvent,
      p_event_epoch: event.eventEpoch,
      p_correlation_key: event.correlationKey,
    });

    if (error || typeof data !== "string") {
      capturePersistenceFailure(event.normalizedEvent);
      return jsonResponse(429, "retry_later", { "Retry-After": "600" });
    }
    if (data === "RECORDED" || data === "DUPLICATE") {
      return jsonResponse(200, "accepted");
    }
    if (data === "CORRELATION_CONFLICT") {
      return jsonResponse(400, "correlation_rejected");
    }
    if (data === "UNMATCHED") {
      if (
        shouldRetryUnmatchedBrevoEvent(event.eventEpoch, Math.floor(Date.now() / 1000))
      ) {
        return jsonResponse(429, "retry_later", { "Retry-After": "600" });
      }
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    capturePersistenceFailure(event.normalizedEvent);
    return jsonResponse(429, "retry_later", { "Retry-After": "600" });
  } catch {
    capturePersistenceFailure(event.normalizedEvent);
    return jsonResponse(429, "retry_later", { "Retry-After": "600" });
  }
}
