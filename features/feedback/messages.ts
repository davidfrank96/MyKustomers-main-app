import type { PublicFeedbackStatus } from "@/features/feedback/public-types";

export function safePublicFeedbackMessage(status: PublicFeedbackStatus) {
  switch (status) {
    case "rate_limited":
      return "Too many attempts. Please try again later.";
    case "invalid_feedback":
      return "Check your feedback and try again.";
    case "already_submitted":
    case "submitted":
      return "This feedback link has already been used.";
    case "expired":
    case "revoked":
    case "booking_unavailable":
    case "unavailable":
    default:
      return "This feedback link is no longer available.";
  }
}
