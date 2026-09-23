"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requirePrivilegedPlatformAdmin,
  PrivilegedPlatformAdminAuthorizationError,
} from "@/lib/admin/server";
import { privilegedReasonSchema } from "@/lib/admin/privileged-access-policy";
import { createClient } from "@/lib/supabase/server";
import type { PrivilegedActionState } from "@/components/admin/privileged-action-dialog";

export async function setWhatsAppBusinessFeature(
  businessId: string,
  enabled: boolean,
  _previous: PrivilegedActionState,
  form: FormData,
): Promise<PrivilegedActionState> {
  try {
    await requirePrivilegedPlatformAdmin(["SUPER_ADMIN"]);
  } catch (error) {
    if (
      error instanceof PrivilegedPlatformAdminAuthorizationError &&
      error.code === "MFA_REQUIRED"
    )
      return { status: "mfa_required", message: "Additional verification required." };
    return {
      status: "error",
      message: "You are not authorized to change business features.",
    };
  }
  const reason = privilegedReasonSchema.safeParse(form.get("reason"));
  if (
    !z.string().uuid().safeParse(businessId).success ||
    typeof enabled !== "boolean" ||
    !reason.success
  )
    return { status: "error", message: "Choose a valid business and provide a reason." };
  const db = await createClient();
  const { data, error } = await db.rpc("set_business_feature_entitlement", {
    p_business_id: businessId,
    p_feature_key: "WHATSAPP_CUSTOMER_UPDATES",
    p_enabled: enabled,
    p_reason: reason.data,
  });
  if (error || data !== true)
    return {
      status: "error",
      message: "Feature access could not be updated. Please try again.",
    };
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/bookings/new");
  revalidatePath("/settings");
  return {
    status: "success",
    message: enabled
      ? "WhatsApp customer updates enabled. Operational sending controls still apply."
      : "WhatsApp customer updates disabled. Email and past delivery records are unchanged.",
  };
}
