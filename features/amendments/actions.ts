"use server";

import { revalidatePath } from "next/cache";
import { publicEnv } from "@/lib/config/public-env";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/security/audit";
import { deliverEmailEvent } from "@/lib/email/outbox";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";
import { isConfirmationShareMethod } from "@/features/confirmation-links/share";
import {
  amendmentExpiresAt,
  generateAmendmentToken,
  hashAmendmentToken,
} from "@/features/amendments/token";
import { bookingAmendmentSchema } from "@/features/amendments/validation";
import type { AmendmentActionState } from "@/features/amendments/action-state";
import { consumeOutboundMessageRateLimit } from "@/lib/security/rate-limit";

function value(formData: FormData, name: string) {
  return formData.get(name);
}

export async function createBookingAmendmentAction(
  bookingId: string,
  _previousState: AmendmentActionState,
  formData: FormData,
): Promise<AmendmentActionState> {
  void _previousState;
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = bookingAmendmentSchema.safeParse({
    reason: value(formData, "reason"),
    title: value(formData, "title"),
    description: value(formData, "description"),
    currency: value(formData, "currency"),
    totalAmount: value(formData, "totalAmount"),
    depositAmount: value(formData, "depositAmount"),
    scheduledFor: value(formData, "scheduledFor"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const rateLimit = await consumeOutboundMessageRateLimit({
    kind: "booking_amendment",
    resourceId: bookingId,
    userId: user.id,
    businessId: business.id,
  });
  if (rateLimit.status !== "allowed") {
    return {
      status: "error",
      message:
        rateLimit.status === "limited"
          ? "Please wait before sending another booking change request. Nothing was sent."
          : "Customer message protection is temporarily unavailable. Nothing was sent.",
      retryAfterSeconds:
        rateLimit.status === "limited" ? rateLimit.retryAfterSeconds : undefined,
    };
  }

  const token = generateAmendmentToken();
  const expiresAt = amendmentExpiresAt();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_amendment", {
    p_booking_id: bookingId,
    p_reason: parsed.data.reason,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_currency: parsed.data.currency,
    p_total_amount_minor: parsed.data.totalAmount,
    p_deposit_amount_minor: parsed.data.depositAmount,
    p_scheduled_for: parsed.data.scheduledFor ?? null,
    p_token_hash: hashAmendmentToken(token),
    p_expires_at: expiresAt.toISOString(),
  });
  const result = data?.[0];

  if (error || !result) {
    return {
      status: "error",
      message: error?.message.includes("amendment_has_no_changes")
        ? "Change at least one customer-agreed detail."
        : "The booking change request could not be created.",
    };
  }

  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const amendmentUrl = `${baseUrl}/a/${token}`;
  await deliverEmailEvent(result.email_event_id, undefined, { amendmentUrl });

  revalidatePath(`/bookings/${bookingId}`);
  return {
    status: "success",
    message:
      result.replaced_amendment_count > 0
        ? "Previous request revoked. New changes are awaiting customer confirmation."
        : "Changes are awaiting customer confirmation.",
    amendmentUrl,
    amendmentId: result.amendment_id,
    expiresAt: result.expires_at,
  };
}

export async function revokeBookingAmendmentAction(
  bookingId: string,
  amendmentId: string,
  _previousState: AmendmentActionState,
  _formData: FormData,
): Promise<AmendmentActionState> {
  void _previousState;
  void _formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_booking_amendment", {
    p_amendment_id: amendmentId,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return error
    ? { status: "error", message: "The booking change request could not be revoked." }
    : {
        status: "success",
        message: data
          ? "Booking change request revoked."
          : "This request is no longer active.",
      };
}

export async function recordAmendmentShareAction(
  bookingId: string,
  amendmentId: string,
  method: ConfirmationShareMethod,
) {
  if (!isConfirmationShareMethod(method) || !canUseServiceRoleClient()) return;
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const { data: amendment } = await createServiceRoleClient()
    .from("booking_amendments")
    .select("id, status, expires_at")
    .eq("id", amendmentId)
    .eq("booking_id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (
    !amendment ||
    amendment.status !== "PENDING_CUSTOMER" ||
    new Date(amendment.expires_at).getTime() <= Date.now()
  ) {
    return;
  }
  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "BOOKING_AMENDMENT_SHARE_INITIATED",
    metadata: { booking_id: bookingId, amendment_id: amendmentId, method },
  });
  revalidatePath(`/bookings/${bookingId}`);
}
