import "server-only";
import { cache } from "react";
import { hasBusinessFeature } from "@/features/business-features/server";
import { createClient } from "@/lib/supabase/server";
import { whatsappAvailable } from "@/lib/whatsapp/config";

export const getWhatsAppAccess = cache(async function getWhatsAppAccess(
  businessId: string,
) {
  const entitled = await hasBusinessFeature(businessId, "WHATSAPP_CUSTOMER_UPDATES");
  if (!entitled || !whatsappAvailable(businessId)) return { entitled, available: false };
  const db = await createClient();
  const { data, error } = await db.rpc("get_whatsapp_rollout_access", {
    p_business_id: businessId,
  });
  return { entitled, available: !error && data === true };
});
