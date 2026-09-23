import "server-only";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { whatsappConfig, whatsappAvailable } from "@/lib/whatsapp/config";
import { publicEnv } from "@/lib/config/public-env";
import { e164Schema } from "./validation";
import { renderWhatsAppMessage, whatsappEventTypes } from "./templates";

const dispatchSchema = z.object({
  event_type: z.enum(whatsappEventTypes),
  business_name: z.string().min(1).max(200),
  booking_reference: z.string().min(1).max(120),
  recipient: e164Schema,
  path_prefix: z.enum(["c", "a", "x", "f"]).nullable(),
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,128}$/)
    .nullable(),
});

// One send per minute invocation: below the gateway's ten-second cooldown.
// Overlapping invocations use independent DB leases; 429 is a proven safe retry.
export async function processWhatsApp() {
  const config = whatsappConfig();
  const provider = getWhatsAppProvider();
  if (!provider) return { processed: 0, accepted: 0, unknown: 0, disabled: true };
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("claim_whatsapp_event", {
    p_business_ids: config.pilotBusinessIds,
  });
  if (error) throw new Error("WhatsApp worker storage unavailable");
  const event = data?.[0];
  if (!event?.lease_id) return { processed: 0, accepted: 0, unknown: 0, disabled: false };
  // Missing/expired/disabled context terminates without sending. If this query
  // fails, the lease later becomes UNKNOWN, never automatically reclaims a send.
  const context = await db.rpc("get_whatsapp_dispatch_context", {
    p_event_id: event.id,
    p_lease_id: event.lease_id,
  });
  if (context.error) throw new Error("WhatsApp worker storage unavailable");
  const parsed = dispatchSchema.safeParse(context.data);
  if (!parsed.success || !whatsappAvailable(event.business_id)) {
    const final = await db.rpc("finish_whatsapp_event", {
      p_event_id: event.id,
      p_lease_id: event.lease_id,
      p_status: "CANCELLED",
      p_error_code: "dispatch_context_unavailable",
    });
    if (final.error || !final.data)
      throw new Error("WhatsApp worker storage unavailable");
    return { processed: 1, accepted: 0, unknown: 0, disabled: false };
  }
  const c = parsed.data;
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const capabilityUrl =
    c.token && c.path_prefix ? `${base}/${c.path_prefix}/${c.token}` : null;
  const result = await provider.sendText({
    intentId: event.id,
    idempotencyKey: event.idempotency_key,
    recipient: c.recipient,
    text: renderWhatsAppMessage({
      eventType: c.event_type,
      businessName: c.business_name,
      bookingReference: c.booking_reference,
      capabilityUrl,
    }),
  });
  const final = await db.rpc("finish_whatsapp_event", {
    p_event_id: event.id,
    p_lease_id: event.lease_id,
    p_status: result.state,
    p_provider_message_id: result.state === "ACCEPTED" ? result.providerMessageId : null,
    p_error_code: result.state === "ACCEPTED" ? null : result.errorCode,
    p_retryable: result.state === "FAILED" && result.retryable,
  });
  if (final.error || !final.data) throw new Error("WhatsApp worker storage unavailable");
  return {
    processed: 1,
    accepted: Number(result.state === "ACCEPTED"),
    unknown: Number(result.state === "UNKNOWN"),
    disabled: false,
  };
}
