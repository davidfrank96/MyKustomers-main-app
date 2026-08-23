"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { publicEnv } from "@/lib/config/public-env";
import { recordAuditEvent } from "@/lib/security/audit";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
    message: data && data > 0 ? "Confirmation link revoked." : "No active link to revoke.",
  };
}
