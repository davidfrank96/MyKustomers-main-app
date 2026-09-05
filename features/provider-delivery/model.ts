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
export type EmailRecoveryAction =
  | "share_confirmation"
  | "share_whatsapp"
  | "check_email"
  | "edit_email"
  | "use_another_contact_method"
  | "add_email";

export type EmailRecoveryPresentation = {
  tone: "neutral" | "positive" | "warning" | "critical";
  title: string;
  description: string;
  primaryAction: EmailRecoveryAction | null;
  secondaryActions: EmailRecoveryAction[];
  allowUnchangedEmailSend: boolean;
  ariaLabel: string;
  transportTitle?: string;
};

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
      title: "Development adapter — no external email sent",
      description: "This operation did not send an email outside My Kustomers.",
    };
  }

  switch (summary.provider_delivery_status) {
    case "DELIVERED":
      return {
        tone: "positive" as const,
        title: "Provider reported delivery",
        description:
          "The customer’s email provider accepted the message. This does not confirm that the customer opened or read it.",
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
      return {
        tone: "critical" as const,
        title: "Email sending is unavailable for this address",
        description: "Check the address and use another contact method.",
      };
    case "COMPLAINT":
      return {
        tone: "critical" as const,
        title: "Email sending has been stopped for this address",
        description: "Use another contact method.",
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
            ? "We have not yet received a delivery update from the customer’s email provider."
            : "A provider outcome has not been recorded.",
      };
  }
}

function recovery(
  value: Omit<EmailRecoveryPresentation, "ariaLabel">,
): EmailRecoveryPresentation {
  return { ...value, ariaLabel: `${value.title}. ${value.description}` };
}

export function getEmailRecoveryPresentation({
  summary,
  confirmed,
  hasCustomerEmail,
}: {
  summary: ProviderDeliverySummary | null | undefined;
  confirmed: boolean;
  hasCustomerEmail: boolean;
}): EmailRecoveryPresentation {
  if (confirmed) {
    const transportTitle = summary ? presentProviderDelivery(summary).title : undefined;
    return recovery({
      tone: "positive",
      title: "Customer confirmed",
      description:
        "Customer confirmation is recorded and remains authoritative for this booking.",
      primaryAction: null,
      secondaryActions: [],
      allowUnchangedEmailSend: false,
      transportTitle,
    });
  }

  if (!hasCustomerEmail) {
    return recovery({
      tone: "neutral",
      title: "No customer email added",
      description:
        "Add an email to send the confirmation, or share the secure link directly.",
      primaryAction: "add_email",
      secondaryActions: ["share_confirmation"],
      allowUnchangedEmailSend: false,
    });
  }

  if (!summary) {
    return recovery({
      tone: "neutral",
      title: "No confirmation email sent",
      description: "Share the secure link directly or review the booking email.",
      primaryAction: "share_confirmation",
      secondaryActions: ["check_email"],
      allowUnchangedEmailSend: true,
    });
  }

  if (summary.development_adapter) {
    return recovery({
      ...presentProviderDelivery(summary),
      primaryAction: "share_confirmation",
      secondaryActions: ["check_email"],
      allowUnchangedEmailSend: true,
    });
  }

  switch (summary.provider_delivery_status) {
    case "DELIVERED":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction: "share_confirmation",
        secondaryActions: [],
        allowUnchangedEmailSend: false,
      });
    case "DEFERRED":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction: "share_whatsapp",
        secondaryActions: ["share_confirmation"],
        allowUnchangedEmailSend: false,
      });
    case "SOFT_BOUNCED":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction: "check_email",
        secondaryActions: ["share_confirmation"],
        allowUnchangedEmailSend: false,
      });
    case "HARD_BOUNCED":
    case "INVALID":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction: "edit_email",
        secondaryActions: ["share_confirmation"],
        allowUnchangedEmailSend: false,
      });
    case "BLOCKED":
    case "COMPLAINT":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction: "use_another_contact_method",
        secondaryActions: ["edit_email", "share_confirmation"],
        allowUnchangedEmailSend: false,
      });
    case "PROVIDER_ERROR":
      return recovery({
        ...presentProviderDelivery(summary),
        primaryAction:
          summary.outbox_status === "FAILED" ? "check_email" : "share_confirmation",
        secondaryActions:
          summary.outbox_status === "FAILED" ? ["share_confirmation"] : ["check_email"],
        allowUnchangedEmailSend: summary.outbox_status === "FAILED",
      });
    default:
      if (summary.outbox_status === "SENT") {
        return recovery({
          tone: "neutral",
          title: "Email accepted for delivery",
          description:
            "We have not yet received a delivery update from the customer’s email provider.",
          primaryAction: "share_confirmation",
          secondaryActions: ["check_email"],
          allowUnchangedEmailSend: false,
        });
      }
      if (summary.outbox_status === "FAILED") {
        return recovery({
          tone: "warning",
          title: "Email acceptance could not be confirmed",
          description:
            "Check the address and share the secure link directly if the customer needs it now.",
          primaryAction: "check_email",
          secondaryActions: ["share_confirmation"],
          allowUnchangedEmailSend: true,
        });
      }
      return recovery({
        tone: "neutral",
        title:
          summary.outbox_status === "SENDING"
            ? "Confirmation email is being sent"
            : "Confirmation email queued",
        description:
          "Wait for the current attempt and share the secure link directly if needed.",
        primaryAction: "share_confirmation",
        secondaryActions: ["check_email"],
        allowUnchangedEmailSend: false,
      });
  }
}
