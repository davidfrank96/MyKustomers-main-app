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

export type PublicFeedbackMetadata = {
  businessName: string;
  businessLogoPath: string | null;
};

export async function getPublicFeedbackMetadata(
  token: string,
): Promise<PublicFeedbackMetadata | null> {
  if (!canUseServiceRoleClient() || !isPlausibleFeedbackToken(token)) {
    return null;
  }

  const tokenHash = hashFeedbackToken(token);
  const allowed = await consumeFeedbackRateLimit("feedback_metadata", tokenHash);
  if (!allowed) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data: link, error: linkError } = await supabase
    .from("feedback_links")
    .select("business_id, booking_id, expires_at, revoked_at, used_at, purpose")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    linkError ||
    !link ||
    link.purpose !== "booking_feedback" ||
    link.revoked_at ||
    (!link.used_at && new Date(link.expires_at).getTime() <= Date.now())
  ) {
    return null;
  }

  const [{ data: booking }, { data: business }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status")
      .eq("id", link.booking_id)
      .eq("business_id", link.business_id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, logo_path")
      .eq("id", link.business_id)
      .maybeSingle(),
  ]);

  if (
    !booking ||
    !business ||
    (booking.status !== "DELIVERED" && booking.status !== "COMPLETED")
  ) {
    return null;
  }

  return {
    businessName: business.name,
    businessLogoPath: business.logo_path,
  };
}

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
