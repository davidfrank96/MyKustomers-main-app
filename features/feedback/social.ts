import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BRAND_PREVIEW_ID,
  ownedBusinessLogoPath,
  type BusinessBrandProjection,
} from "@/features/businesses/brand-projection";
import { hashFeedbackToken, isPlausibleFeedbackToken } from "./token";

export async function getPublicFeedbackMetadata(token: string) {
  if (!canUseServiceRoleClient() || !isPlausibleFeedbackToken(token)) return null;
  return readFeedbackBrand("token_hash", hashFeedbackToken(token));
}

export async function getPublicFeedbackImageMetadata(previewId: string) {
  if (!canUseServiceRoleClient() || !BRAND_PREVIEW_ID.test(previewId)) return null;
  return readFeedbackBrand("id", previewId);
}

async function readFeedbackBrand(
  column: "token_hash" | "id",
  value: string,
): Promise<BusinessBrandProjection | null> {
  const supabase = createServiceRoleClient();
  const { data: link, error } = await supabase
    .from("feedback_links")
    .select("id, business_id, booking_id, expires_at, revoked_at, used_at, purpose")
    .eq(column, value)
    .maybeSingle();
  if (
    error ||
    !link ||
    link.purpose !== "booking_feedback" ||
    link.revoked_at ||
    (!link.used_at && !(new Date(link.expires_at).getTime() > Date.now()))
  )
    return null;
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
  )
    return null;
  // Both capability versions resolve by their existing hash. No HMAC/Vault read,
  // feedback-content lookup, rate-limit write, or submission-state copy.
  return {
    previewId: link.id,
    businessName: business.name,
    businessLogoPath: ownedBusinessLogoPath(link.business_id, business.logo_path),
  };
}
