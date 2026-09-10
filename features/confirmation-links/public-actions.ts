"use server";

import { confirmPublicBooking } from "@/features/confirmation-links/public";
import type { PublicConfirmationActionState } from "@/features/confirmation-links/public-action-state";

export async function confirmPublicBookingAction(
  token: string,
  _previousState: PublicConfirmationActionState,
  formData: FormData,
): Promise<PublicConfirmationActionState> {
  const result = await confirmPublicBooking(token, {
    contactEmail: formData.get("contact_email"),
    contactPhone: formData.get("contact_phone"),
  });

  if (result.status === "confirmed") {
    return {
      status: "success",
      businessName: result.confirmation?.businessName ?? null,
      contactEmail: result.confirmation?.contactEmail ?? null,
      alreadyConfirmed: false,
    };
  }

  if (result.status === "already_confirmed") {
    return {
      status: "success",
      businessName: null,
      contactEmail: null,
      alreadyConfirmed: true,
    };
  }

  if (result.status === "invalid_contact") {
    return {
      status: "error",
      message: "Check the highlighted contact details.",
      fieldErrors: result.fieldErrors,
    };
  }

  return {
    status: "error",
    message: "The booking could not be confirmed with this link.",
  };
}
