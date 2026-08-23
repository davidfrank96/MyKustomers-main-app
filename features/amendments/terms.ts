import { materialBookingFields } from "@/features/confirmation-links/terms";

export const amendableBookingFields = materialBookingFields.filter(
  (field) => field !== "customer_id",
);

export type AmendableBookingField = (typeof amendableBookingFields)[number];

export const amendmentFieldLabels: Record<AmendableBookingField, string> = {
  title: "Booking",
  description: "Details",
  currency: "Currency",
  total_amount_minor: "Agreed total",
  deposit_amount_minor: "Deposit recorded",
  scheduled_for: "Scheduled",
};

export function isAmendableBookingStatus(status: string) {
  return status === "CONFIRMED" || status === "IN_PROGRESS";
}
