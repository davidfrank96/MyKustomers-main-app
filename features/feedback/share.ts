import {
  confirmationShareMethods,
  type ConfirmationShareMethod,
} from "@/features/confirmation-links/share";

export type FeedbackShareMethod = ConfirmationShareMethod;

function cleanName(value: string | null | undefined, fallback: string) {
  return (
    value
      ?.replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || fallback
  );
}

export function buildFeedbackShareMessage({
  customerName,
  businessName,
}: {
  customerName?: string | null;
  businessName: string;
}) {
  const firstName = cleanName(customerName, "").split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName} 👋` : "Hi 👋";

  return `${greeting}\n\n${cleanName(businessName, "The business")} would appreciate your private feedback about your experience.\n\nShare your feedback here:`;
}

export function buildFeedbackShareTitle(businessName: string) {
  return `Share private feedback with ${cleanName(businessName, "your business")}`;
}

export function isFeedbackShareMethod(value: unknown): value is FeedbackShareMethod {
  return confirmationShareMethods.includes(value as FeedbackShareMethod);
}
