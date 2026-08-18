"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";
import type { BookingActionState } from "@/features/bookings/action-state";
import {
  bookingCreateSchema,
  bookingTransitionSchema,
  bookingUpdateSchema,
} from "@/features/bookings/validation";
import {
  getBookingForBusiness,
  customerBelongsToBusiness,
} from "@/features/bookings/queries";
import {
  isAllowedBookingTransition,
  isTerminalBookingStatus,
} from "@/features/bookings/status";

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

async function requireCurrentBusiness(next = "/bookings") {
  const user = await requireUser(next);
  const context = await getCurrentBusinessContext();

  if (!context.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return { user, business: context.currentBusiness };
}

function parseCreateForm(formData: FormData) {
  return bookingCreateSchema.safeParse({
    customerId: formValue(formData, "customerId"),
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
  const { user, business } = await requireCurrentBusiness("/bookings/new");
  const parsed = parseCreateForm(formData);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const customerAllowed = await customerBelongsToBusiness(
    business.id,
    parsed.data.customerId,
  );

  if (!customerAllowed) {
    return {
      status: "error",
      message: "Choose an active customer from this business.",
      fieldErrors: { customerId: ["Choose an active customer from this business."] },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      business_id: business.id,
      customer_id: parsed.data.customerId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      currency: parsed.data.currency,
      total_amount_minor: parsed.data.totalAmount,
      deposit_amount_minor: parsed.data.depositAmount,
      scheduled_for: parsed.data.scheduledFor ?? null,
      internal_notes: parsed.data.internalNotes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: mapBookingError(),
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "BOOKING_CREATED",
    metadata: { booking_id: data.id },
  });

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  redirect(`/bookings/${data.id}?created=1` as Route);
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

  const changedFields = Object.entries(nextBooking)
    .filter(([key, value]) => existingBooking[key as keyof typeof existingBooking] !== value)
    .map(([key]) => key);

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

export async function transitionBookingStatusAction(
  bookingId: string,
  toStatus: string,
) {
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = bookingTransitionSchema.safeParse({ toStatus });

  if (!parsed.success) {
    redirect(`/bookings/${bookingId}?message=invalid-status` as Route);
  }

  const booking = await getBookingForBusiness(business.id, bookingId);

  if (!booking || !isAllowedBookingTransition(booking.status, parsed.data.toStatus)) {
    redirect(`/bookings/${bookingId}?message=invalid-transition` as Route);
  }

  const nextValues: {
    status: typeof parsed.data.toStatus;
    cancelled_at?: string | null;
    completed_at?: string | null;
  } = {
    status: parsed.data.toStatus,
  };

  if (parsed.data.toStatus === "CANCELLED") {
    nextValues.cancelled_at = new Date().toISOString();
  }

  if (parsed.data.toStatus === "COMPLETED") {
    nextValues.completed_at = new Date().toISOString();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update(nextValues)
    .eq("business_id", business.id)
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (!error && data) {
    const eventType =
      parsed.data.toStatus === "CANCELLED"
        ? "BOOKING_CANCELLED"
        : parsed.data.toStatus === "COMPLETED"
          ? "BOOKING_COMPLETED"
          : "BOOKING_STATUS_CHANGED";

    await recordAuditEvent({
      actorUserId: user.id,
      businessId: business.id,
      eventType,
      metadata: {
        booking_id: bookingId,
        from_status: booking.status,
        to_status: parsed.data.toStatus,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}?message=status-updated` as Route);
}
