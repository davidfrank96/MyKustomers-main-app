import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { ownedBusinessLogoPath } from "./brand-projection";
import { BUSINESS_LOGO_PATH_PATTERN } from "./logo-public";

export async function getEventBusinessLogoPath(businessId: string) {
  if (
    !canUseServiceRoleClient() ||
    !BUSINESS_LOGO_PATH_PATTERN.test(`${businessId}/logo.webp`)
  )
    return null;
  try {
    const { data, error } = await createServiceRoleClient()
      .from("businesses")
      .select("logo_path")
      .eq("id", businessId)
      .abortSignal(AbortSignal.timeout(2500))
      .maybeSingle();
    return !error && data ? ownedBusinessLogoPath(businessId, data.logo_path) : null;
  } catch {
    // Branding is optional and cannot prevent an otherwise valid email dispatch.
    return null;
  }
}
