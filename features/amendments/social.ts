import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BRAND_PREVIEW_ID,
  ownedBusinessLogoPath,
  type BusinessBrandProjection,
} from "@/features/businesses/brand-projection";
import { hashAmendmentToken, isPlausibleAmendmentToken } from "./token";

export async function getPublicAmendmentMetadata(token: string) {
  if (!canUseServiceRoleClient() || !isPlausibleAmendmentToken(token)) return null;
  return readAmendmentBrand("token_hash", hashAmendmentToken(token));
}

export async function getPublicAmendmentImageMetadata(previewId: string) {
  if (!canUseServiceRoleClient() || !BRAND_PREVIEW_ID.test(previewId)) return null;
  return readAmendmentBrand("id", previewId);
}

async function readAmendmentBrand(
  column: "token_hash" | "id",
  value: string,
): Promise<BusinessBrandProjection | null> {
  const supabase = createServiceRoleClient();
  const { data: amendment, error } = await supabase
    .from("booking_amendments")
    .select("id, business_id, booking_id, status, expires_at, base_terms_hash")
    .eq(column, value)
    .maybeSingle();
  if (
    error ||
    !amendment ||
    !["PENDING_CUSTOMER", "CONFIRMED"].includes(amendment.status) ||
    (amendment.status !== "CONFIRMED" &&
      !(new Date(amendment.expires_at).getTime() > Date.now()))
  )
    return null;
  const [{ data: booking }, { data: business }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, confirmation_terms_hash")
      .eq("id", amendment.booking_id)
      .eq("business_id", amendment.business_id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, logo_path")
      .eq("id", amendment.business_id)
      .maybeSingle(),
  ]);
  if (
    !booking ||
    !business ||
    (amendment.status !== "CONFIRMED" &&
      (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status) ||
        booking.confirmation_terms_hash !== amendment.base_terms_hash))
  )
    return null;
  return {
    previewId: amendment.id,
    businessName: business.name,
    businessLogoPath: ownedBusinessLogoPath(amendment.business_id, business.logo_path),
  };
}
