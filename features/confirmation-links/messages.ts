import type { PublicConfirmationStatus } from "@/features/confirmation-links/public-types";

export function safePublicConfirmationMessage(status: PublicConfirmationStatus) {
  if (status === "rate_limited") {
    return "Too many attempts. Please wait and try again.";
  }

  if (status === "already_confirmed") {
    return "This booking has already been confirmed.";
  }

  if (status === "confirmed") {
    return "Booking confirmed.";
  }

  return "This confirmation link is no longer available. Please contact the business for a new link.";
}
