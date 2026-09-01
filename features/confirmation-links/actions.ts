"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { publicEnv } from "@/lib/config/public-env";
import { recordAuditEvent } from "@/lib/security/audit";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deliverEmailEvent } from "@/lib/email/outbox";
import { requiredCustomerEmailSchema } from "@/features/customers/validation";
import {
  confirmationLinkExpiresAt,
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import type { ConfirmationLinkActionState } from "@/features/confirmation-links/action-state";
import {
  isConfirmationShareMethod,
  type ConfirmationShareMethod,
} from "@/features/confirmation-links/share";

export async function generateConfirmationLinkAction(
  bookingId: string,
  previousState: ConfirmationLinkActionState,
  formData: FormData,
): Promise<ConfirmationLinkActionState> {
  void previousState;
  void formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const token = generateConfirmationToken();
  const expiresAt = confirmationLinkExpiresAt();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_confirmation_link", {
    p_booking_id: bookingId,
    p_token_hash: hashConfirmationToken(token),
    p_expires_at: expiresAt.toISOString(),
  });

  if (error || !data?.[0]) {
    return {
      status: "error",
      message: "A confirmation link could not be generated for this booking.",
    };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const confirmationUrl = `${baseUrl}/c/${token}`;

  return {
    status: "success",
    message:
      data[0].replaced_link_count > 0
        ? "Previous link revoked. New confirmation link generated."
        : "Confirmation link generated.",
    confirmationUrl,
    confirmationLinkId: data[0].confirmation_link_id,
    expiresAt: data[0].expires_at,
  };
}

export async function sendConfirmationEmailAction(
  bookingId: string,
  previousState: ConfirmationLinkActionState,
  formData: FormData,
): Promise<ConfirmationLinkActionState> {
  void previousState;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = requiredCustomerEmailSchema.safeParse(formData.get("recipientEmail"));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the recipient email before sending.",
      fieldErrors: { recipientEmail: parsed.error.issues.map((issue) => issue.message) },
    };
  }

  const token = generateConfirmationToken();
  const expiresAt = confirmationLinkExpiresAt();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_confirmation_request", {
    p_booking_id: bookingId,
    p_contact_email: parsed.data,
    p_token_hash: hashConfirmationToken(token),
    p_expires_at: expiresAt.toISOString(),
  });
  const request = data?.[0];

  if (error || !request) {
    return {
      status: "error",
      message: "The confirmation request could not be created. Nothing was sent.",
      recipientEmail: parsed.data,
    };
  }

  if (request.request_status === "duplicate_ignored") {
    return {
      status: "success",
      message: `A request to ${request.recipient_email} was already queued moments ago. No duplicate email was sent.`,
      recipientEmail: request.recipient_email,
      deliveryStatus: "duplicate",
      confirmationLinkId: request.confirmation_link_id,
      expiresAt: request.expires_at,
    };
  }

  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const confirmationUrl = `${baseUrl}/c/${token}`;
  const delivery = await deliverEmailEvent(request.email_event_id, undefined, {
    confirmationUrl,
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  if (delivery.status === "sent") {
    return {
      status: "success",
      message: `Email accepted for delivery to ${request.recipient_email}.`,
      recipientEmail: request.recipient_email,
      deliveryStatus: "accepted",
      confirmationLinkId: request.confirmation_link_id,
      expiresAt: request.expires_at,
    };
  }

  return {
    status: "error",
    message: `The request was saved, but the email was not accepted for delivery to ${request.recipient_email}. You can try again safely.`,
    recipientEmail: request.recipient_email,
    deliveryStatus: "failed",
    confirmationLinkId: request.confirmation_link_id,
    expiresAt: request.expires_at,
  };
}

export async function recordConfirmationShareAction(
  bookingId: string,
  confirmationLinkId: string,
  method: ConfirmationShareMethod,
): Promise<void> {
  if (!isConfirmationShareMethod(method) || !canUseServiceRoleClient()) {
    return;
  }

  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const supabase = createServiceRoleClient();
  const { data: link } = await supabase
    .from("confirmation_links")
    .select("id, expires_at, revoked_at, used_at")
    .eq("id", confirmationLinkId)
    .eq("booking_id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (
    !link ||
    link.revoked_at ||
    link.used_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    return;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "CONFIRMATION_SHARE_INITIATED",
    metadata: {
      booking_id: bookingId,
      confirmation_link_id: confirmationLinkId,
      method,
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
}

export async function revokeConfirmationLinkAction(
  bookingId: string,
  previousState: ConfirmationLinkActionState,
  formData: FormData,
): Promise<ConfirmationLinkActionState> {
  void previousState;
  void formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_booking_confirmation_link", {
    p_booking_id: bookingId,
  });

  if (error) {
    return {
      status: "error",
      message: "The confirmation link could not be revoked.",
    };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  return {
    status: "success",
    message:
      data && data > 0 ? "Confirmation link revoked." : "No active link to revoke.",
  };
}
