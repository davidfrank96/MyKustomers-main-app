import type { EmailDeliveryResult } from "@/lib/email/outbox";
import type { ConfirmationLinkActionState } from "./action-state";

const definiteNonAcceptance = new Set([
  "provider_not_configured",
  "provider_connect_failure",
  "invalid_recipient",
  "invalid_sender",
  "invalid_confirmation_request_event",
  "confirmation_url_unavailable",
  "confirmation_url_invalid",
  "invalid_email_thread",
]);

// Presentation only: this never authorizes a retry or changes outbox state.
export function confirmationDispatchFeedback(
  result: EmailDeliveryResult,
): Pick<ConfirmationLinkActionState, "status" | "deliveryStatus" | "message"> {
  if (result.status === "sent") {
    return {
      status: "success",
      deliveryStatus: "accepted",
      message: "Email accepted for delivery.",
    };
  }
  if (result.status === "skipped" && result.reason === "service-role-unavailable") {
    return {
      status: "error",
      deliveryStatus: "queued",
      message:
        "The request was saved, but email processing did not start. Share the secure link directly if the customer needs it now.",
    };
  }
  if (result.status === "failed") {
    if (result.code === "provider_http_429") {
      return {
        status: "error",
        deliveryStatus: "rate_limited",
        message: "Too many recent attempts. Please wait before trying again.",
      };
    }
    if (
      definiteNonAcceptance.has(result.code) ||
      (/^provider_http_[45]\d\d$/.test(result.code) &&
        result.code !== "provider_http_408")
    ) {
      return {
        status: "error",
        deliveryStatus: "failed",
        message:
          "The email was not accepted. Check the address and try again, or share the confirmation link directly.",
      };
    }
  }
  // A lost claim/result or unknown failure cannot establish non-acceptance.
  return {
    status: "error",
    deliveryStatus: "ambiguous",
    message:
      "We could not confirm whether the email was accepted. Avoid sending it repeatedly. Share the secure link directly if the customer needs it now.",
  };
}
