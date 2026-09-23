"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requirePrivilegedPlatformAdmin,
  PrivilegedPlatformAdminAuthorizationError,
} from "@/lib/admin/server";
import { privilegedReasonSchema } from "@/lib/admin/privileged-access-policy";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getWhatsAppControl } from "@/lib/whatsapp/control";
import { controlActions, type ControlAction } from "./control-model";
import type { PrivilegedActionState } from "@/components/admin/privileged-action-dialog";
export async function changeWhatsAppSession(
  action: ControlAction,
  _previous: PrivilegedActionState,
  form: FormData,
): Promise<PrivilegedActionState> {
  try {
    await requirePrivilegedPlatformAdmin(["SUPER_ADMIN"]);
  } catch (error) {
    return {
      status:
        error instanceof PrivilegedPlatformAdminAuthorizationError &&
        error.code === "MFA_REQUIRED"
          ? "mfa_required"
          : "error",
      message: "Additional privileged authorization is required.",
    };
  }
  const reason = privilegedReasonSchema.safeParse(form.get("reason"));
  if (
    !z.enum(controlActions).safeParse(action).success ||
    !reason.success ||
    /[0-9][0-9 ()+.-]{6,}[0-9]|@|https?:\/\//.test(reason.data)
  )
    return {
      status: "error",
      message: "Provide a reason without phone numbers, addresses or links.",
    };
  const control = getWhatsAppControl();
  if (!control) return { status: "error", message: "Gateway control not configured." };
  const db = await createClient();
  const prepared = await db.rpc("begin_whatsapp_control", {
    p_action: action,
    p_reason: reason.data,
  });
  if (prepared.error || !z.string().uuid().safeParse(prepared.data).success)
    return {
      status: "error",
      message:
        "The request could not be authorized and audited. Another operation may still be running.",
    };
  const succeeded = await control.mutate(action, prepared.data!);
  // Result attestations are server-only. A failed final audit leaves SQL paused.
  const result = await createServiceRoleClient().rpc("finish_whatsapp_control", {
    p_operation_id: prepared.data!,
    p_succeeded: succeeded,
  });
  revalidatePath("/admin/whatsapp");
  revalidatePath("/admin/security");
  if (!succeeded || result.error || result.data !== true)
    return {
      status: "error",
      message:
        "Operation not confirmed. Sending remains paused. Refresh status before trying again.",
    };
  return {
    status: "success",
    message:
      action === "resume"
        ? "Connection verified. Controlled sending may resume; all existing restrictions still apply."
        : action === "pair" || action === "replace"
          ? "Pairing started. Open the pairing code below. Sending remains paused until you verify and resume."
          : "Session request completed. Sending remains paused until you verify and resume.",
  };
}
