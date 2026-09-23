import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BusinessFeature } from "./keys";

// Request-local only. A grant/revoke must be visible on the next server request.
// RLS applies to the authenticated account, never a browser-supplied authority.
export const readBusinessFeature = cache(async function readBusinessFeature(
  businessId: string,
  feature: BusinessFeature,
): Promise<boolean | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("business_feature_entitlements")
    .select("enabled")
    .eq("business_id", businessId)
    .eq("feature_key", feature)
    .maybeSingle();
  return error ? null : data?.enabled === true;
});

export async function hasBusinessFeature(businessId: string, feature: BusinessFeature) {
  return (await readBusinessFeature(businessId, feature)) === true;
}
