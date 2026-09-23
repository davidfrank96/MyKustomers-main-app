import "server-only";
import { whatsappConfig } from "./config";
import { WaAkgProvider } from "./providers/wa-akg";
import type { WhatsAppProvider } from "./types";

export function getWhatsAppProvider(
  env: Record<string, string | undefined> = process.env,
): WhatsAppProvider | null {
  const config = whatsappConfig(env);
  if (!config.enabled || config.provider !== "wa_akg") return null;
  try {
    const url = new URL(env.WA_AKG_BASE_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      !/^[a-f0-9]{64}$/i.test(env.WA_AKG_API_KEY ?? "") ||
      !/^[a-z0-9-]{1,64}$/.test(env.WA_AKG_SESSION_ID ?? "")
    )
      return null;
    return new WaAkgProvider(url.origin, env.WA_AKG_API_KEY!, env.WA_AKG_SESSION_ID!);
  } catch {
    return null;
  }
}
