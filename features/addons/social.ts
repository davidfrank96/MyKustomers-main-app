import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BRAND_PREVIEW_ID,
  ownedBusinessLogoPath,
  type BusinessBrandProjection,
} from "@/features/businesses/brand-projection";
import { hashAddonToken, isPlausibleAddonToken } from "./token";

export async function getPublicAddonMetadata(token: string) {
  if (!canUseServiceRoleClient() || !isPlausibleAddonToken(token)) return null;
  return readAddonBrand("token_hash", hashAddonToken(token));
}

export async function getPublicAddonImageMetadata(previewId: string) {
  if (!canUseServiceRoleClient() || !BRAND_PREVIEW_ID.test(previewId)) return null;
  return readAddonBrand("id", previewId);
}

async function readAddonBrand(
  column: "token_hash" | "id",
  value: string,
): Promise<BusinessBrandProjection | null> {
  const supabase = createServiceRoleClient();
  const { data: link, error } = await supabase
    .from("booking_addon_confirmation_links")
    .select(
      "id, business_id, booking_id, booking_addon_id, purpose, expires_at, used_at, revoked_at",
    )
    .eq(column, value)
    .maybeSingle();
  if (
    error ||
    !link ||
    link.purpose !== "booking_addon_confirmation" ||
    link.revoked_at ||
    (!link.used_at && !(new Date(link.expires_at).getTime() > Date.now()))
  )
    return null;
  const [{ data: booking }, { data: addon }, { data: business }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status")
      .eq("id", link.booking_id)
      .eq("business_id", link.business_id)
      .maybeSingle(),
    supabase
      .from("booking_addons")
      .select("status")
      .eq("id", link.booking_addon_id)
      .eq("booking_id", link.booking_id)
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
    !addon ||
    !business ||
    (link.used_at ? addon.status !== "CONFIRMED" : addon.status !== "AWAITING_CUSTOMER")
  )
    return null;
  return {
    previewId: link.id,
    businessName: business.name,
    businessLogoPath: ownedBusinessLogoPath(link.business_id, business.logo_path),
  };
}
