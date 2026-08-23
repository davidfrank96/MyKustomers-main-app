"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import type { PublicAddonActionState } from "@/features/addons/action-state";
import { confirmPublicAddon } from "@/features/addons/public";
import { safePublicAddonMessage } from "@/features/addons/messages";

export async function confirmPublicAddonAction(
  token: string,
  _previousState: PublicAddonActionState,
  _formData: FormData,
): Promise<PublicAddonActionState> {
  void _previousState;
  void _formData;
  const result = await confirmPublicAddon(token);
  if (result.status === "confirmed" || result.status === "already_confirmed") {
    redirect(`/x/${token}?confirmed=1` as Route);
  }
  return { status: "error", message: safePublicAddonMessage(result.status) };
}
