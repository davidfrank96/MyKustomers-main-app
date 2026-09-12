import { createHash, timingSafeEqual } from "node:crypto";
export function validWorkerAuthorization(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || !header || header.length > 512) return false;
  return timingSafeEqual(
    createHash("sha256").update(header).digest(),
    createHash("sha256").update(`Bearer ${secret}`).digest(),
  );
}
export function retryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Math.min(Number(value), 86400);
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.min(86400, Math.max(0, Math.ceil((date - now) / 1000)))
    : null;
}
export function notificationTopic(id: string) {
  return createHash("sha256").update(id).digest("base64url").slice(0, 32);
}
