import type { Booking } from "@/features/bookings/queries";

export const materialBookingFields = [
  "title",
  "description",
  "currency",
  "total_amount_minor",
  "deposit_amount_minor",
  "scheduled_for",
] as const satisfies readonly (keyof Booking)[];

export const nonMaterialBookingFields = ["internal_notes"] as const satisfies readonly (keyof Booking)[];

export type MaterialBookingField = (typeof materialBookingFields)[number];

export function hasMaterialBookingFieldChange(changedFields: string[]) {
  return changedFields.some((field) =>
    (materialBookingFields as readonly string[]).includes(field),
  );
}

export function isConfirmationEligibleStatus(status: Booking["status"]) {
  return status === "DRAFT" || status === "AWAITING_CUSTOMER";
}
