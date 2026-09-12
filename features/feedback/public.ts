import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { consumeFeedbackRateLimit } from "@/features/feedback/rate-limit";
import { hashFeedbackToken, isPlausibleFeedbackToken } from "@/features/feedback/token";
import { publicFeedbackSchema } from "@/features/feedback/validation";
import type {
  PublicFeedbackBooking,
  PublicFeedbackStatus,
  PublicFeedbackView,
} from "@/features/feedback/public-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublicFeedbackView(value: unknown): PublicFeedbackView {
  if (!isRecord(value) || typeof value.status !== "string") {
    return { status: "unavailable" };
  }

  const status = value.status as PublicFeedbackStatus;

  if (!isRecord(value.booking)) {
    return { status };
  }

  return {
    status,
    booking: value.booking as PublicFeedbackBooking,
  };
}

export async function getPublicFeedbackView(token: string): Promise<PublicFeedbackView> {
  if (!canUseServiceRoleClient() || !isPlausibleFeedbackToken(token)) {
    return { status: "unavailable" };
  }

  const tokenHash = hashFeedbackToken(token);
  const allowed = await consumeFeedbackRateLimit("feedback_lookup", tokenHash);

  if (!allowed) {
    return { status: "rate_limited" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_feedback_public_view", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { status: "unavailable" };
  }

  return parsePublicFeedbackView(data);
}

export { getPublicFeedbackMetadata } from "./social";
export type { BusinessBrandProjection as PublicFeedbackMetadata } from "@/features/businesses/brand-projection";

export async function recordPublicFeedbackOpen(token: string) {
  if (!canUseServiceRoleClient() || !isPlausibleFeedbackToken(token)) {
    return;
  }

  const tokenHash = hashFeedbackToken(token);
  const allowed = await consumeFeedbackRateLimit("feedback_open", tokenHash);
  if (!allowed) return;

  const supabase = createServiceRoleClient();
  await supabase.rpc("record_feedback_link_open", {
    p_token_hash: tokenHash,
  });
}

export async function submitPublicFeedback(token: string, formData: FormData) {
  if (!canUseServiceRoleClient() || !isPlausibleFeedbackToken(token)) {
    return { status: "unavailable" as const };
  }

  const tokenHash = hashFeedbackToken(token);
  const allowed = await consumeFeedbackRateLimit("feedback_submit", tokenHash);

  if (!allowed) {
    return { status: "rate_limited" as const };
  }

  const parsed = publicFeedbackSchema.safeParse({
    overallRating: formData.get("overallRating"),
    onTime: formData.get("onTime"),
    metExpectations: formData.get("metExpectations"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return { status: "invalid_feedback" as const };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("submit_feedback_by_token_hash", {
    p_token_hash: tokenHash,
    p_overall_rating: parsed.data.overallRating,
    p_on_time: parsed.data.onTime,
    p_met_expectations: parsed.data.metExpectations,
    p_comment: parsed.data.comment ?? null,
  });

  if (error) {
    return { status: "unavailable" as const };
  }

  const result = parsePublicFeedbackView(data);
  return { status: result.status };
}
