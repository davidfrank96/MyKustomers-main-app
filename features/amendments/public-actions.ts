"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import type { PublicAmendmentActionState } from "@/features/amendments/action-state";
import { confirmPublicAmendment } from "@/features/amendments/public";
import { safePublicAmendmentMessage } from "@/features/amendments/messages";

export async function confirmPublicAmendmentAction(
  token: string,
  _previousState: PublicAmendmentActionState,
  _formData: FormData,
): Promise<PublicAmendmentActionState> {
  void _previousState;
  void _formData;
  const result = await confirmPublicAmendment(token);
  if (result.status === "confirmed" || result.status === "already_confirmed") {
    redirect(`/a/${token}?confirmed=1` as Route);
  }
  return { status: "error", message: safePublicAmendmentMessage(result.status) };
}
