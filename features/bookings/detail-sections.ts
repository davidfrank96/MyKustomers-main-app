import type { BookingStatus } from "@/features/bookings/status";

export const bookingDetailSectionIds = [
  "operational-progress",
  "customer-confirmation",
  "booking-payments",
  "booking-changes",
  "booking-addons",
  "private-feedback",
  "operational-issues",
  "reschedule",
  "booking-details",
  "operational-timeline",
] as const;

export type BookingDetailSectionId = (typeof bookingDetailSectionIds)[number];

type DefaultBookingDetailSectionInput = {
  status: BookingStatus;
  feedbackReceived: boolean;
  pendingAmendment: boolean;
  awaitingAddon: boolean;
};

export function getDefaultOpenBookingDetailSection({
  status,
  feedbackReceived,
  pendingAmendment,
  awaitingAddon,
}: DefaultBookingDetailSectionInput): BookingDetailSectionId | null {
  if (pendingAmendment) return "booking-changes";
  if (awaitingAddon) return "booking-addons";

  switch (status) {
    case "DRAFT":
    case "AWAITING_CUSTOMER":
      return "customer-confirmation";
    case "CONFIRMED":
    case "IN_PROGRESS":
    case "READY":
      return "operational-progress";
    case "DELIVERED":
      return "booking-payments";
    case "COMPLETED":
      return feedbackReceived ? null : "private-feedback";
    case "CANCELLED":
      return null;
  }
}
