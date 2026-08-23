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
  addonExpiresAt,
  generateAddonToken,
  hashAddonToken,
} from "@/features/addons/token";
import { bookingAddonSchema } from "@/features/addons/validation";
import type { AddonActionState } from "@/features/addons/action-state";

function value(formData: FormData, name: string) {
  return formData.get(name);
}

function addonErrorMessage(message: string | undefined) {
  if (message?.includes("pending_amendment")) {
    return "Resolve the pending booking change before sending an add-on.";
  }
  if (message?.includes("pending_addon")) {
    return "Resolve the current add-on request before sending another.";
  }
  if (message?.includes("not_eligible")) {
    return "This booking can no longer accept add-ons.";
  }
  return "The add-on request could not be completed.";
}

export async function createBookingAddonAction(
  bookingId: string,
  _previousState: AddonActionState,
  formData: FormData,
): Promise<AddonActionState> {
  void _previousState;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = bookingAddonSchema.safeParse({
    title: value(formData, "title"),
    description: value(formData, "description"),
    totalAmount: value(formData, "totalAmount"),
    depositAmount: value(formData, "depositAmount"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data, error } = await (
    await createClient()
  ).rpc("create_booking_addon", {
    p_booking_id: bookingId,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_total_amount_minor: parsed.data.totalAmount,
    p_deposit_amount_minor: parsed.data.depositAmount,
  });
  const result = data?.[0];
  if (error || !result) {
    return { status: "error", message: addonErrorMessage(error?.message) };
  }
  revalidatePath(`/bookings/${bookingId}`);
  return {
    status: "success",
    message: "Add-on saved as a draft. Review it before sending it to the customer.",
    addonId: result.booking_addon_id,
  };
}

export async function submitBookingAddonAction(
  bookingId: string,
  addonId: string,
  _previousState: AddonActionState,
  _formData: FormData,
): Promise<AddonActionState> {
  void _previousState;
  void _formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const token = generateAddonToken();
  const expiresAt = addonExpiresAt();
  const { data, error } = await (
    await createClient()
  ).rpc("submit_booking_addon", {
    p_booking_addon_id: addonId,
    p_token_hash: hashAddonToken(token),
    p_expires_at: expiresAt.toISOString(),
  });
  const result = data?.[0];
  if (error || !result) {
    return { status: "error", message: addonErrorMessage(error?.message) };
  }

  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const addonUrl = `${baseUrl}/x/${token}`;
  await deliverEmailEvent(result.email_event_id, undefined, { addonUrl });
  revalidatePath(`/bookings/${bookingId}`);
  return {
    status: "success",
    message:
      result.replaced_link_count > 0
        ? "Previous link revoked. The replacement is ready to share."
        : "Add-on is awaiting customer confirmation.",
    addonUrl,
    addonId: result.booking_addon_id,
    confirmationLinkId: result.confirmation_link_id,
    expiresAt: result.expires_at,
  };
}

export async function cancelBookingAddonAction(
  bookingId: string,
  addonId: string,
  _previousState: AddonActionState,
  _formData: FormData,
): Promise<AddonActionState> {
  void _previousState;
  void _formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const { data, error } = await (
    await createClient()
  ).rpc("cancel_booking_addon", {
    p_booking_addon_id: addonId,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return error
    ? { status: "error", message: addonErrorMessage(error.message) }
    : {
        status: "success",
        message: data ? "Add-on cancelled." : "This add-on is already cancelled.",
      };
}

export async function recordAddonShareAction(
  bookingId: string,
  addonId: string,
  confirmationLinkId: string,
  method: ConfirmationShareMethod,
) {
  if (!isConfirmationShareMethod(method) || !canUseServiceRoleClient()) return;
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const { data: link } = await createServiceRoleClient()
    .from("booking_addon_confirmation_links")
    .select("id, expires_at, used_at, revoked_at")
    .eq("id", confirmationLinkId)
    .eq("booking_addon_id", addonId)
    .eq("booking_id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (
    !link ||
    link.used_at ||
    link.revoked_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    return;
  }
  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "BOOKING_ADDON_SHARE_INITIATED",
    metadata: {
      booking_id: bookingId,
      booking_addon_id: addonId,
      confirmation_link_id: confirmationLinkId,
      method,
    },
  });
  revalidatePath(`/bookings/${bookingId}`);
}
