import type { PublicAddonStatus } from "@/features/addons/public-types";

export function safePublicAddonMessage(status: PublicAddonStatus) {
  if (status === "rate_limited") {
    return "Too many attempts. Please wait and try again.";
  }
  if (status === "already_confirmed" || status === "confirmed") {
    return "This addition has already been confirmed.";
  }
  if (status === "booking_unavailable") {
    return "This addition can no longer be confirmed for the current booking state.";
  }
  return "This booking addition link is no longer available. Please contact the business for a new link.";
}
