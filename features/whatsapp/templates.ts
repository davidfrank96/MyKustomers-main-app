export const whatsappEventTypes = [
  "BOOKING_CONFIRMATION_REQUESTED",
  "BOOKING_CONFIRMED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
  "BOOKING_DELIVERED",
  "BOOKING_AMENDMENT_REQUESTED",
  "BOOKING_AMENDMENT_CONFIRMED",
  "BOOKING_ADDON_REQUESTED",
  "BOOKING_ADDON_CONFIRMED",
] as const;
export type WhatsAppEventType = (typeof whatsappEventTypes)[number];
const copy: Record<WhatsAppEventType, string> = {
  BOOKING_CONFIRMATION_REQUESTED:
    "Please review and confirm your booking using the secure link below.",
  BOOKING_CONFIRMED: "Your booking is confirmed. Thank you.",
  BOOKING_RESCHEDULED:
    "Your booking has been rescheduled. Please review and confirm the updated booking below.",
  BOOKING_CANCELLED:
    "Your booking has been cancelled. Contact the business if you have questions.",
  BOOKING_DELIVERED:
    "Your booking has been delivered. Please share your private feedback using the secure link below.",
  BOOKING_AMENDMENT_REQUESTED:
    "There is a proposed change to your booking. Please review it using the secure link below.",
  BOOKING_AMENDMENT_CONFIRMED: "Your booking changes are confirmed. Thank you.",
  BOOKING_ADDON_REQUESTED:
    "An add-on is ready for your review. Please use the secure link below.",
  BOOKING_ADDON_CONFIRMED: "Your booking add-on is confirmed. Thank you.",
};
export function renderWhatsAppMessage(input: {
  eventType: WhatsAppEventType;
  businessName: string;
  bookingReference: string;
  capabilityUrl?: string | null;
}) {
  const safeText = (value: string, max: number) =>
    value
      .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, max);
  return [
    safeText(input.businessName, 120),
    `Booking ${safeText(input.bookingReference, 80)}`,
    copy[input.eventType],
    input.capabilityUrl,
    "Powered by My Kustomers",
  ]
    .filter(Boolean)
    .join("\n\n");
}
