"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { publicEnv } from "@/lib/config/public-env";
import { recordAuditEvent } from "@/lib/security/audit";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  FeedbackLinkActionState,
  IssueActionState,
} from "@/features/feedback/action-state";
import {
  bookingIssueCreateSchema,
  isResolvableIssueStatus,
} from "@/features/feedback/validation";
import {
  feedbackLinkExpiresAt,
  generateFeedbackToken,
  hashFeedbackToken,
} from "@/features/feedback/token";
import {
  isFeedbackShareMethod,
  type FeedbackShareMethod,
} from "@/features/feedback/share";

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
  } satisfies IssueActionState;
}

export async function generateFeedbackLinkAction(
  bookingId: string,
  previousState: FeedbackLinkActionState,
  formData: FormData,
): Promise<FeedbackLinkActionState> {
  void previousState;
  void formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const token = generateFeedbackToken();
  const expiresAt = feedbackLinkExpiresAt();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_feedback_link", {
    p_booking_id: bookingId,
    p_token_hash: hashFeedbackToken(token),
    p_expires_at: expiresAt.toISOString(),
  });

  if (error || !data?.[0]) {
    return {
      status: "error",
      message: "A feedback link could not be generated for this booking.",
    };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const feedbackUrl = `${baseUrl}/f/${token}`;

  return {
    status: "success",
    message:
      data[0].replaced_link_count > 0
        ? "Previous feedback link revoked. New feedback link generated."
        : "Feedback link generated.",
    feedbackUrl,
    feedbackLinkId: data[0].feedback_link_id,
    expiresAt: data[0].expires_at,
  };
}

export async function recordFeedbackShareAction(
  bookingId: string,
  feedbackLinkId: string,
  method: FeedbackShareMethod,
): Promise<void> {
  if (!isFeedbackShareMethod(method) || !canUseServiceRoleClient()) {
    return;
  }

  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const supabase = createServiceRoleClient();
  const [{ data: link }, { data: booking }] = await Promise.all([
    supabase
      .from("feedback_links")
      .select("id, expires_at, revoked_at, used_at")
      .eq("id", feedbackLinkId)
      .eq("booking_id", bookingId)
      .eq("business_id", business.id)
      .eq("purpose", "booking_feedback")
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .eq("status", "COMPLETED")
      .maybeSingle(),
  ]);

  if (
    !link ||
    !booking ||
    link.revoked_at ||
    link.used_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    return;
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "FEEDBACK_SHARE_INITIATED",
    metadata: {
      booking_id: bookingId,
      feedback_link_id: feedbackLinkId,
      method,
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
}

export async function revokeFeedbackLinkAction(
  bookingId: string,
  previousState: FeedbackLinkActionState,
  formData: FormData,
): Promise<FeedbackLinkActionState> {
  void previousState;
  void formData;
  await requireCurrentBusiness(`/bookings/${bookingId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_booking_feedback_link", {
    p_booking_id: bookingId,
  });

  if (error) {
    return {
      status: "error",
      message: "The feedback link could not be revoked.",
    };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);

  return {
    status: "success",
    message:
      data && data > 0 ? "Feedback link revoked." : "No active feedback link to revoke.",
  };
}

export async function createBookingIssueAction(
  bookingId: string,
  _previousState: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const parsed = bookingIssueCreateSchema.safeParse({
    category: formValue(formData, "category"),
    description: formValue(formData, "description"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_issues")
    .insert({
      business_id: business.id,
      booking_id: bookingId,
      category: parsed.data.category,
      description: parsed.data.description,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "The issue could not be created.",
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "ISSUE_CREATED",
    metadata: {
      booking_id: bookingId,
      issue_id: data.id,
      category: parsed.data.category,
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}?message=issue-created` as Route);
}

export async function resolveBookingIssueAction(
  bookingId: string,
  issueId: string,
  status: string,
) {
  const { user, business } = await requireCurrentBusiness(`/bookings/${bookingId}`);

  if (!isResolvableIssueStatus(status)) {
    redirect(`/bookings/${bookingId}?message=issue-resolution-unavailable` as Route);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_issues")
    .update({ status: "RESOLVED" })
    .eq("business_id", business.id)
    .eq("booking_id", bookingId)
    .eq("id", issueId)
    .eq("status", "OPEN")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/bookings/${bookingId}?message=issue-resolution-unavailable` as Route);
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "ISSUE_RESOLVED",
    metadata: {
      booking_id: bookingId,
      issue_id: issueId,
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}?message=issue-resolved` as Route);
}
