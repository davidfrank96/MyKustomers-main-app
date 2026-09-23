import { createClient } from "@/lib/supabase/server";
import { whatsappConfig } from "@/lib/whatsapp/config";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { z } from "zod";
const summarySchema = z.object({
  pending: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  failed_recently: z.number().int().nonnegative(),
});
export async function WhatsAppAdminHealth() {
  await requirePlatformAdmin();
  const config = whatsappConfig();
  const provider = getWhatsAppProvider();
  if (!config.pilotBusinessIds.length) return null;
  const db = await createClient();
  const [summary, health] = await Promise.all([
    db.rpc("get_whatsapp_admin_summary"),
    provider?.health() ?? Promise.resolve(null),
  ]);
  const counts = summary.error ? null : summarySchema.safeParse(summary.data);
  return (
    <section
      aria-labelledby="whatsapp-admin-title"
      className="my-5 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="whatsapp-admin-title" className="font-semibold">
        WhatsApp channel
      </h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt>Channel</dt>
        <dd>{config.enabled ? "Enabled for pilot businesses" : "Disabled"}</dd>
        <dt>Provider</dt>
        <dd>{config.provider === "wa_akg" ? "WA-AKG" : "Unsupported"}</dd>
        <dt>Gateway</dt>
        <dd>
          {health === "CONNECTED" || health === "DISCONNECTED"
            ? "Healthy"
            : health === "AUTH_FAILURE"
              ? "Authentication failed"
              : health === "UNREACHABLE"
                ? "Unreachable"
                : "Not checked"}
        </dd>
        <dt>WhatsApp session</dt>
        <dd>
          {health === "CONNECTED"
            ? "Connected"
            : health === "DISCONNECTED"
              ? "Disconnected"
              : "Unknown"}
        </dd>
        <dt>Pending</dt>
        <dd>{counts?.success ? counts.data.pending : "Unavailable"}</dd>
        <dt>Unknown</dt>
        <dd>{counts?.success ? counts.data.unknown : "Unavailable"}</dd>
        <dt>Failed in 24 hours</dt>
        <dd>{counts?.success ? counts.data.failed_recently : "Unavailable"}</dd>
      </dl>
    </section>
  );
}
