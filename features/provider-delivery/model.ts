import { z } from "zod";

export const providerDeliveryStatuses = [
  "UNKNOWN",
  "DELIVERED",
  "DEFERRED",
  "SOFT_BOUNCED",
  "HARD_BOUNCED",
  "INVALID",
  "BLOCKED",
  "COMPLAINT",
  "PROVIDER_ERROR",
] as const;

export const providerDeliveryReasons = [
  "NONE",
  "TEMPORARY_DELIVERY_FAILURE",
  "PERMANENT_DELIVERY_FAILURE",
  "INVALID_ADDRESS",
  "SENDING_BLOCKED",
  "COMPLAINT",
  "PROVIDER_ERROR",
] as const;

const timestampSchema = z.string().datetime({ offset: true });
export const providerDeliverySummarySchema = z
  .object({
    outbox_status: z.enum(["PENDING", "SENDING", "SENT", "FAILED"]),
    development_adapter: z.boolean(),
    provider_delivery_status: z.enum(providerDeliveryStatuses),
    provider_event_at: timestampSchema.nullable(),
    reason_category: z.enum(providerDeliveryReasons).nullable(),
    evidence_received_at: timestampSchema.nullable(),
  })
  .strict();

export type ProviderDeliverySummary = z.infer<typeof providerDeliverySummarySchema>;
export type ProviderDeliveryStatus = (typeof providerDeliveryStatuses)[number];

export const unknownProviderDelivery: ProviderDeliverySummary = {
  outbox_status: "PENDING",
  development_adapter: false,
  provider_delivery_status: "UNKNOWN",
  provider_event_at: null,
  reason_category: null,
  evidence_received_at: null,
};

export function parseProviderDeliverySummary(value: unknown) {
  const parsed = providerDeliverySummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function presentProviderDelivery(summary: ProviderDeliverySummary) {
  if (summary.development_adapter) {
    return {
      tone: "neutral" as const,
      title: "Development adapter — no external delivery",
      description: "This operation did not send an email outside My Kustomers.",
    };
  }

  switch (summary.provider_delivery_status) {
    case "DELIVERED":
      return {
        tone: "positive" as const,
        title: "Provider reported delivery",
        description: "This does not confirm that the customer opened the email.",
      };
    case "DEFERRED":
      return {
        tone: "warning" as const,
        title: "Delivery delayed",
        description: "The customer’s email provider has temporarily delayed the message.",
      };
    case "SOFT_BOUNCED":
      return {
        tone: "warning" as const,
        title: "Email could not be delivered after temporary attempts",
        description: "Check the address or share the confirmation link directly.",
      };
    case "HARD_BOUNCED":
    case "INVALID":
      return {
        tone: "critical" as const,
        title: "Email could not be delivered",
        description: "The address may be incorrect or unavailable.",
      };
    case "BLOCKED":
    case "COMPLAINT":
      return {
        tone: "critical" as const,
        title: "Email sending is unavailable for this address",
        description: "Check the address and use another contact method.",
      };
    case "PROVIDER_ERROR":
      return {
        tone: "warning" as const,
        title: "Provider reported a delivery error",
        description: "Share the secure link directly if the customer needs it now.",
      };
    default:
      return {
        tone: "neutral" as const,
        title:
          summary.outbox_status === "SENT"
            ? "Email accepted for delivery"
            : "No provider delivery update",
        description:
          summary.outbox_status === "SENT"
            ? "Awaiting customer confirmation."
            : "A provider outcome has not been recorded.",
      };
  }
}
