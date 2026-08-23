import type { PublicAmendmentStatus } from "@/features/amendments/public-types";

export function safePublicAmendmentMessage(status: PublicAmendmentStatus) {
  if (status === "rate_limited") return "Too many attempts. Please wait and try again.";
  if (status === "already_confirmed" || status === "confirmed") {
    return "These booking changes have already been confirmed.";
  }
  if (status === "stale") {
    return "This request no longer matches the current booking. Please contact the business for a new link.";
  }
  return "This booking change link is no longer available. Please contact the business for a new link.";
}
