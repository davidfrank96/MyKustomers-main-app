"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";
import type { BookingActionState } from "@/features/bookings/action-state";
import {
  bookingCreateSchema,
  bookingInternalNotesSchema,
  bookingRescheduleSchema,
  bookingTransitionSchema,
  bookingUpdateSchema,
} from "@/features/bookings/validation";
import { getBookingForBusiness } from "@/features/bookings/queries";
import { findPotentialDuplicateCustomers } from "@/features/customers/queries";
import {
  areMaterialBookingTermsLocked,
  isTerminalBookingStatus,
} from "@/features/bookings/status";
import { hasMaterialBookingFieldChange } from "@/features/confirmation-links/terms";
import { deliverEmailEvent } from "@/lib/email/outbox";

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies BookingActionState;
}

function mapBookingError() {
  return "Booking details could not be saved. Please try again.";
}

function parseCreateForm(formData: FormData) {
  return bookingCreateSchema.safeParse({
    customerMode: formValue(formData, "customerMode"),
    customerId: formValue(formData, "customerId"),
    newCustomerName: formValue(formData, "newCustomerName"),
    newCustomerEmail: formValue(formData, "newCustomerEmail"),
    newCustomerPhone: formValue(formData, "newCustomerPhone"),
    duplicateAcknowledged: formValue(formData, "duplicateAcknowledged") === "true",
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    currency: formValue(formData, "currency"),
    totalAmount: formValue(formData, "totalAmount"),
    depositAmount: formValue(formData, "depositAmount"),
    scheduledFor: formValue(formData, "scheduledFor"),
    internalNotes: formValue(formData, "internalNotes"),
  });
}

function parseUpdateForm(formData: FormData) {
  return bookingUpdateSchema.safeParse({
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    currency: formValue(formData, "currency"),
    totalAmount: formValue(formData, "totalAmount"),
    depositAmount: formValue(formData, "depositAmount"),
    scheduledFor: formValue(formData, "scheduledFor"),
    internalNotes: formValue(formData, "internalNotes"),
  });
}

export async function createBookingAction(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const { business } = await requireCurrentBusiness("/bookings/new");
  const parsed = parseCreateForm(formData);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (parsed.data.customerMode === "new" && !parsed.data.duplicateAcknowledged) {
    const duplicateCandidates = await findPotentialDuplicateCustomers({
      businessId: business.id,
      name: parsed.data.newCustomerName,
      email: parsed.data.newCustomerEmail,
      phone: parsed.data.newCustomerPhone,
    });

    if (duplicateCandidates.length > 0) {
      return {
        status: "error",
        message: "A possible existing customer was found.",
        duplicateCandidates,
        duplicateInput: {
          name: parsed.data.newCustomerName,
          email: parsed.data.newCustomerEmail ?? null,
          phone: parsed.data.newCustomerPhone ?? null,
        },
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_with_customer", {
    p_customer_mode: parsed.data.customerMode,
    p_customer_id:
      parsed.data.customerMode === "existing" ? parsed.data.customerId : null,
    p_new_customer_name:
      parsed.data.customerMode === "new" ? parsed.data.newCustomerName : null,
    p_new_customer_email:
      parsed.data.customerMode === "new" ? (parsed.data.newCustomerEmail ?? null) : null,
    p_new_customer_phone:
      parsed.data.customerMode === "new" ? (parsed.data.newCustomerPhone ?? null) : null,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_currency: parsed.data.currency,
    p_total_amount_minor: parsed.data.totalAmount,
    p_deposit_amount_minor: parsed.data.depositAmount,
    p_scheduled_for: parsed.data.scheduledFor ?? null,
    p_internal_notes: parsed.data.internalNotes ?? null,
  });
  const createdBooking = data?.[0];

  if (error || !createdBooking) {
    if (parsed.data.customerMode === "existing") {
      return {
        status: "error",
        message: "Choose an active customer from this business.",
        fieldErrors: { customerId: ["Choose an active customer from this business."] },
      };
    }

    return {
      status: "error",
      message: mapBookingError(),
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  redirect(`/bookings/${createdBooking.booking_id}?created=1` as Route);
}

export async function updateBookingAction(
  bookingId: string,
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const existingBooking = await getBookingForBusiness(business.id, bookingId);

  if (!existingBooking || isTerminalBookingStatus(existingBooking.status)) {
    return {
      status: "error",
      message: "This booking cannot be edited.",
    };
  }

  const parsed = parseUpdateForm(formData);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const nextBooking = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    currency: parsed.data.currency,
    total_amount_minor: parsed.data.totalAmount,
    deposit_amount_minor: parsed.data.depositAmount,
    scheduled_for: parsed.data.scheduledFor ?? null,
    internal_notes: parsed.data.internalNotes ?? null,
  };

  const changedFields = Object.entries(nextBooking)
    .filter(
      ([key, value]) => existingBooking[key as keyof typeof existingBooking] !== value,
    )
    .map(([key]) => key);

  if (
    areMaterialBookingTermsLocked(existingBooking.status) &&
    hasMaterialBookingFieldChange(changedFields)
  ) {
    return {
      status: "error",
      message: "Customer-confirmed booking details are locked.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update(nextBooking)
    .eq("business_id", business.id)
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: mapBookingError(),
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "BOOKING_UPDATED",
    metadata: { booking_id: bookingId, changed_fields: changedFields },
  });

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  return {
    status: "success",
    message: "Booking updated.",
  };
}

export async function updateBookingInternalNotesAction(
  bookingId: string,
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const existingBooking = await getBookingForBusiness(business.id, bookingId);

  if (!existingBooking || isTerminalBookingStatus(existingBooking.status)) {
    return {
      status: "error",
      message: "This booking cannot be edited.",
    };
  }

  const parsed = bookingInternalNotesSchema.safeParse({
    internalNotes: formValue(formData, "internalNotes"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const internalNotes = parsed.data.internalNotes ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ internal_notes: internalNotes })
    .eq("business_id", business.id)
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: mapBookingError(),
    };
  }

  if (existingBooking.internal_notes !== internalNotes) {
    await recordAuditEvent({
      actorUserId: user.id,
      businessId: business.id,
      eventType: "BOOKING_UPDATED",
      metadata: { booking_id: bookingId, changed_fields: ["internal_notes"] },
    });
  }

  revalidatePath(`/bookings/${bookingId}`);

  return {
    status: "success",
    message: "Internal notes updated.",
  };
}

export async function transitionBookingStatusAction(
  bookingId: string,
  toStatus: string,
  formData?: FormData,
) {
  const { business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const booking = await getBookingForBusiness(business.id, bookingId);

  if (!booking) {
    redirect(`/bookings/${bookingId}?message=invalid-transition` as Route);
  }

  const parsed = bookingTransitionSchema.safeParse({
    fromStatus: booking.status,
    toStatus,
    cancellationReason: formData ? formValue(formData, "cancellationReason") : undefined,
  });

  if (!parsed.success) {
    redirect(`/bookings/${bookingId}?message=invalid-status` as Route);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_booking_status", {
    p_booking_id: bookingId,
    p_to_status: parsed.data.toStatus,
    p_cancellation_reason: parsed.data.cancellationReason ?? null,
  });

  if (error) {
    redirect(`/bookings/${bookingId}?message=invalid-transition` as Route);
  }

  const emailEventId = data?.[0]?.email_event_id;
  if (emailEventId) {
    await deliverEmailEvent(emailEventId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}?message=status-updated` as Route);
}

export async function rescheduleBookingAction(
  bookingId: string,
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = bookingRescheduleSchema.safeParse({
    scheduledFor: formValue(formData, "scheduledFor"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: bookingId,
    p_scheduled_for: parsed.data.scheduledFor,
  });

  if (error || !data?.[0]) {
    return {
      status: "error",
      message: "This booking could not be rescheduled.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  return {
    status: "success",
    message:
      data[0].status === "AWAITING_CUSTOMER"
        ? "Booking rescheduled. Customer confirmation is required again."
        : "Booking rescheduled.",
  };
}
