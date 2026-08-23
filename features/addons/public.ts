import "server-only";
import { z } from "zod";
import { bookingCurrencies } from "@/features/bookings/money";
import type { PublicAddonStatus, PublicAddonView } from "@/features/addons/public-types";
import { consumeAddonRateLimit } from "@/features/addons/rate-limit";
import { hashAddonToken, isPlausibleAddonToken } from "@/features/addons/token";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { deliverEmailEvent } from "@/lib/email/outbox";

const addonSchema = z.object({
  business_name: z.string(),
  business_logo_path: z.string().nullable(),
  business_website: z.string().nullable(),
  business_instagram: z.string().nullable(),
  booking_reference: z.string(),
  booking_title: z.string(),
  scheduled_for: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  currency: z.enum(bookingCurrencies),
  total_amount_minor: z.number().int().nonnegative(),
  deposit_amount_minor: z.number().int().nonnegative(),
  balance_amount_minor: z.number().int().nonnegative(),
  expires_at: z.string(),
  confirmed_at: z.string().nullable(),
});

function parseView(value: unknown): PublicAddonView {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return { status: "unavailable" };
  }
  const raw = value as { status?: unknown; addon?: unknown };
  if (typeof raw.status !== "string") return { status: "unavailable" };
  const status = raw.status as PublicAddonStatus;
  const addon = addonSchema.safeParse(raw.addon);
  return addon.success ? { status, addon: addon.data } : { status };
}

export async function getPublicAddonView(token: string): Promise<PublicAddonView> {
  if (!(await consumeAddonRateLimit("addon_lookup"))) {
    return { status: "rate_limited" };
  }
  if (!canUseServiceRoleClient() || !isPlausibleAddonToken(token)) {
    return { status: "unavailable" };
  }
  const { data, error } = await createServiceRoleClient().rpc(
    "get_booking_addon_public_view",
    { p_token_hash: hashAddonToken(token) },
  );
  return error ? { status: "unavailable" } : parseView(data);
}

export async function getPublicAddonMetadata(token: string) {
  if (
    !canUseServiceRoleClient() ||
    !isPlausibleAddonToken(token) ||
    !(await consumeAddonRateLimit("addon_metadata"))
  ) {
    return null;
  }
  const supabase = createServiceRoleClient();
  const { data: link } = await supabase
    .from("booking_addon_confirmation_links")
    .select("business_id, expires_at, used_at, revoked_at")
    .eq("token_hash", hashAddonToken(token))
    .maybeSingle();
  if (
    !link ||
    link.revoked_at ||
    (!link.used_at && new Date(link.expires_at).getTime() <= Date.now())
  ) {
    return null;
  }
  const { data: business } = await supabase
    .from("businesses")
    .select("name, logo_path")
    .eq("id", link.business_id)
    .maybeSingle();
  return business ?? null;
}

export async function recordPublicAddonOpen(token: string) {
  if (
    !canUseServiceRoleClient() ||
    !isPlausibleAddonToken(token) ||
    !(await consumeAddonRateLimit("addon_open"))
  ) {
    return;
  }
  await createServiceRoleClient().rpc("record_booking_addon_open", {
    p_token_hash: hashAddonToken(token),
  });
}

export async function confirmPublicAddon(token: string): Promise<PublicAddonView> {
  if (!(await consumeAddonRateLimit("addon_confirm"))) {
    return { status: "rate_limited" };
  }
  if (!canUseServiceRoleClient() || !isPlausibleAddonToken(token)) {
    return { status: "unavailable" };
  }
  const { data, error } = await createServiceRoleClient().rpc(
    "confirm_booking_addon_by_token_hash",
    { p_token_hash: hashAddonToken(token) },
  );
  if (error) return { status: "unavailable" };
  if (
    data &&
    typeof data === "object" &&
    "status" in data &&
    data.status === "confirmed" &&
    "email_event_id" in data &&
    typeof data.email_event_id === "string"
  ) {
    await deliverEmailEvent(data.email_event_id);
  }
  return parseView(data);
}
