import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { consumeApplicationRateLimit } from "@/lib/security/rate-limit";

export function notificationResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export class NotificationHttpError extends Error {
  constructor(public status: number) {
    super("Notification request unavailable");
  }
}
export async function notificationAuth(request?: Request) {
  if (request) {
    const url = new URL(request.url);
    // Next may use its internal listener name in request.url. Host remains the
    // browser's destination and cannot be overridden by browser fetch calls.
    const requestOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
    if (request.headers.get("origin") !== requestOrigin)
      throw new NotificationHttpError(403);
  }
  if (!isSupabasePublicEnvConfigured()) throw new NotificationHttpError(401);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new NotificationHttpError(401);
  if (request) {
    const limit = await consumeApplicationRateLimit({
      action: "notifications_mutation",
      keyParts: [data.user.id],
      policy: { maxRequests: 90, windowSeconds: 3600, blockSeconds: 60 },
    });
    if (limit.status !== "allowed")
      throw new NotificationHttpError(limit.status === "limited" ? 429 : 503);
  }
  return { supabase, user: data.user };
}
export async function boundedJson(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new NotificationHttpError(415);
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new NotificationHttpError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new NotificationHttpError(400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new NotificationHttpError(413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof NotificationHttpError) throw error;
    throw new NotificationHttpError(400);
  } finally {
    reader.releaseLock();
  }
}
export function notificationError(error: unknown) {
  const status = error instanceof NotificationHttpError ? error.status : 503;
  return notificationResponse(
    {
      error:
        status === 401
          ? "Please sign in again."
          : status === 429
            ? "Please wait a moment and try again."
            : "Notifications are unavailable. Please try again.",
    },
    status,
  );
}
