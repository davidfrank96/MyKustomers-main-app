"use server";

import { z } from "zod";
import type { PrivilegedActionState } from "@/components/admin/privileged-action-dialog";
import {
  createPrivilegedActionAuditEvidence,
  privilegedReasonSchema,
} from "@/lib/admin/privileged-access-policy";
import {
  PrivilegedPlatformAdminAuthorizationError,
  requirePrivilegedPlatformAdmin,
} from "@/lib/admin/server";
import { adminEmailEventTypeValues } from "@/features/admin/email-operations";
import { deliverClaimedEmailEvent } from "@/lib/email/outbox";
import { getTransactionalEmailProviderSelectionForName } from "@/lib/email/provider";
import { getEmailRetryEligibility } from "@/lib/email/retry-policy";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const emailEventIdSchema = z.string().uuid();
const providerSchema = z.enum(["development", "brevo", "resend", "unknown"]);
const eventTypeSchema = z.enum(adminEmailEventTypeValues);
const claimResultSchema = z
  .object({
    status: z.literal("CLAIMED"),
    attempt_id: z.string().uuid(),
    attempt_number: z.number().int().positive(),
    provider: z.enum(["development", "brevo", "resend"]),
  })
  .strict();

function safeError(message: string): PrivilegedActionState {
  return { status: "error", message };
}

export async function retryFailedEmailAction(
  emailEventId: string,
  _previousState: PrivilegedActionState,
  formData: FormData,
): Promise<PrivilegedActionState> {
  const parsedEventId = emailEventIdSchema.safeParse(emailEventId);
  if (!parsedEventId.success) return safeError("Email event unavailable.");

  let admin;
  try {
    admin = await requirePrivilegedPlatformAdmin(["SUPER_ADMIN"]);
  } catch (error) {
    if (
      error instanceof PrivilegedPlatformAdminAuthorizationError &&
      error.code === "MFA_REQUIRED"
    ) {
      return { status: "mfa_required", message: "Additional verification required." };
    }
    return safeError("You are not authorized to retry this email event.");
  }

  const reasonResult = privilegedReasonSchema.safeParse(formData.get("reason"));
  if (!reasonResult.success) {
    return safeError(reasonResult.error.issues[0]?.message ?? "A reason is required.");
  }

  const evidence = createPrivilegedActionAuditEvidence({
    admin,
    action: "RETRY_FAILED_EMAIL",
    targetId: parsedEventId.data,
    reason: reasonResult.data,
    result: "ATTEMPTED",
  });
  const service = createServiceRoleClient();
  const { data: event, error: eventError } = await service
    .from("email_events")
    .select("id, event_type, status, attempt_count, failure_code")
    .eq("id", parsedEventId.data)
    .maybeSingle();

  if (eventError || !event) return safeError("Email event unavailable.");

  const { data: latestAttempt, error: attemptError } = await service
    .from("email_delivery_attempts")
    .select("attempt_number, provider, status, failure_code")
    .eq("email_event_id", event.id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const eventType = eventTypeSchema.safeParse(event.event_type);
  const provider = providerSchema.safeParse(latestAttempt?.provider);
  if (attemptError || !eventType.success || !provider.success) {
    return safeError("Retry unavailable because delivery evidence is incomplete.");
  }

  const selection =
    provider.data === "unknown"
      ? null
      : getTransactionalEmailProviderSelectionForName(provider.data);
  const eligibility = getEmailRetryEligibility({
    status: event.status,
    eventType: eventType.data,
    attemptCount: event.attempt_count,
    failureCode: event.failure_code,
    latestAttempt: latestAttempt
      ? {
          attemptNumber: latestAttempt.attempt_number,
          provider: latestAttempt.provider,
          status: latestAttempt.status,
          failureCode: latestAttempt.failure_code,
        }
      : null,
    isProviderConfigured: (candidate) =>
      selection?.name === candidate && selection.configured,
  });

  if (!eligibility.eligible || !selection || !event.failure_code) {
    return safeError(eligibility.explanation);
  }

  const { data: claimData, error: claimError } = await service.rpc(
    "claim_platform_admin_email_retry",
    {
      p_email_event_id: event.id,
      p_admin_user_id: evidence.adminUserId,
      p_reason: evidence.reason!,
      p_expected_attempt_count: event.attempt_count,
      p_expected_failure_code: event.failure_code,
      p_expected_provider: selection.name,
    },
  );
  const claim = claimError ? null : claimResultSchema.safeParse(claimData);

  if (!claim?.success) {
    return safeError(
      "Retry was not started because the event or administrator state changed.",
    );
  }

  const result = await deliverClaimedEmailEvent({
    emailEventId: event.id,
    attemptId: claim.data.attempt_id,
    provider: selection.provider,
  });

  if (result.status === "sent") {
    return {
      status: "success",
      message: "Delivery attempt accepted by provider.",
    };
  }

  return safeError(
    result.status === "failed"
      ? "Delivery attempt failed. Review the updated safe failure category."
      : "Delivery attempt could not be started because the event state changed.",
  );
}
