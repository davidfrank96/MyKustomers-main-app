import "server-only";
import { z } from "zod";

export function whatsappConfig(env: Record<string, string | undefined> = process.env) {
  const ids = (env.WHATSAPP_PILOT_BUSINESS_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const validIds =
    ids.length > 0 && ids.every((id) => z.string().uuid().safeParse(id).success);
  return {
    enabled: env.WHATSAPP_ENABLED === "true" && env.VERCEL_ENV !== "preview" && validIds,
    provider: env.WHATSAPP_PROVIDER ?? "wa_akg",
    pilotBusinessIds: validIds ? [...new Set(ids)] : [],
  };
}
export function whatsappAvailable(businessId: string) {
  const config = whatsappConfig();
  return (
    config.enabled &&
    config.provider === "wa_akg" &&
    config.pilotBusinessIds.includes(businessId)
  );
}
