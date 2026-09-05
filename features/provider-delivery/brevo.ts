import { z } from "zod";

export const BREVO_WEBHOOK_MAX_BODY_BYTES = 32 * 1024;
export const BREVO_UNMATCHED_RETRY_SECONDS = 10 * 60;

const brevoPayloadSchema = z
  .object({
    event: z.enum([
      "delivered",
      "deferred",
      "soft_bounce",
      "hard_bounce",
      "invalid_email",
      "blocked",
      "spam",
      "error",
    ]),
    messageId: z
      .string()
      .min(1)
      .max(255)
      .regex(/^(<[^<>\s]+>|[^<>\s]+)$/),
    eventEpoch: z.number().int().min(1_577_836_800),
    correlationKey: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .strict();

export type BrevoProviderEvent = z.infer<typeof brevoPayloadSchema> & {
  normalizedEvent: BrevoNormalizedEvent;
};

export type BrevoNormalizedEvent =
  | "DELIVERED"
  | "DEFERRED"
  | "SOFT_BOUNCED"
  | "HARD_BOUNCED"
  | "INVALID"
  | "BLOCKED"
  | "COMPLAINT"
  | "PROVIDER_ERROR";

const normalizedEvents: Record<
  z.infer<typeof brevoPayloadSchema>["event"],
  BrevoNormalizedEvent
> = {
  delivered: "DELIVERED",
  deferred: "DEFERRED",
  soft_bounce: "SOFT_BOUNCED",
  hard_bounce: "HARD_BOUNCED",
  invalid_email: "INVALID",
  blocked: "BLOCKED",
  spam: "COMPLAINT",
  error: "PROVIDER_ERROR",
};

export function isUnsupportedBrevoEvent(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).event === "string" &&
    !Object.hasOwn(
      normalizedEvents,
      (value as Record<string, unknown>).event as PropertyKey,
    )
  );
}

export function parseBrevoTransactionalPayload(
  value: unknown,
): BrevoProviderEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const rawCorrelation = payload["X-Mailin-custom"];
  const correlationKey =
    typeof rawCorrelation === "string" &&
    /^mk-attempt-v1:[a-f0-9]{64}$/.test(rawCorrelation)
      ? rawCorrelation.slice("mk-attempt-v1:".length)
      : rawCorrelation === undefined || rawCorrelation === null || rawCorrelation === ""
        ? null
        : undefined;
  const parsed = brevoPayloadSchema.safeParse({
    event: payload.event,
    messageId: payload["message-id"],
    eventEpoch: payload.ts_event,
    correlationKey,
  });
  if (!parsed.success) return null;
  if (parsed.data.eventEpoch > Math.floor(Date.now() / 1000) + 300) return null;
  return { ...parsed.data, normalizedEvent: normalizedEvents[parsed.data.event] };
}

export function shouldRetryUnmatchedBrevoEvent(eventEpoch: number, nowEpoch: number) {
  return eventEpoch >= nowEpoch - BREVO_UNMATCHED_RETRY_SECONDS;
}
