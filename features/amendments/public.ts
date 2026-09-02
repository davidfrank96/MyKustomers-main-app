import "server-only";
import { z } from "zod";
import { bookingCurrencies } from "@/features/bookings/money";
import { amendableBookingFields } from "@/features/amendments/terms";
import type { AmendableBookingField } from "@/features/amendments/terms";
import type {
  PublicAmendmentStatus,
  PublicAmendmentView,
} from "@/features/amendments/public-types";
import { consumeAmendmentRateLimit } from "@/features/amendments/rate-limit";
import {
  hashAmendmentToken,
  isPlausibleAmendmentToken,
} from "@/features/amendments/token";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { deliverEmailEvent } from "@/lib/email/outbox";

const termsSchema = z.object({
  business_name: z.string(),
  customer_name: z.string(),
  booking_reference: z.string(),
  title: z.string(),
  description: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  currency: z.enum(bookingCurrencies),
  total_amount_minor: z.number().int().nonnegative(),
  deposit_amount_minor: z.number().int().nonnegative(),
  balance_amount_minor: z.number().int().nonnegative(),
  scheduled_for: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

const amendmentSchema = z.object({
  business_name: z.string(),
  business_logo_path: z.string().nullable(),
  business_website: z.string().nullable(),
  business_instagram: z.string().nullable(),
  booking_reference: z.string(),
  reason: z.string(),
  current_terms: termsSchema,
  proposed_terms: termsSchema,
  changed_fields: z.array(
    z.custom<AmendableBookingField>((value) =>
      amendableBookingFields.includes(value as AmendableBookingField),
    ),
  ),
  expires_at: z.string(),
  confirmed_at: z.string().nullable(),
});

function parseView(value: unknown): PublicAmendmentView {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return { status: "unavailable" };
  }
  const raw = value as { status?: unknown; amendment?: unknown };
  if (typeof raw.status !== "string") return { status: "unavailable" };
  const status = raw.status as PublicAmendmentStatus;
  const amendment = amendmentSchema.safeParse(raw.amendment);
  return amendment.success ? { status, amendment: amendment.data } : { status };
}

export async function getPublicAmendmentView(
  token: string,
): Promise<PublicAmendmentView> {
  if (!canUseServiceRoleClient() || !isPlausibleAmendmentToken(token)) {
    return { status: "unavailable" } satisfies PublicAmendmentView;
  }
  const tokenHash = hashAmendmentToken(token);
  if (!(await consumeAmendmentRateLimit("amendment_lookup", tokenHash))) {
    return { status: "rate_limited" } satisfies PublicAmendmentView;
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_booking_amendment_public_view", {
    p_token_hash: tokenHash,
  });
  return error ? { status: "unavailable" } : parseView(data);
}

export async function getPublicAmendmentMetadata(token: string) {
  if (
    !canUseServiceRoleClient() ||
    !isPlausibleAmendmentToken(token)
  ) {
    return null;
  }
  const tokenHash = hashAmendmentToken(token);
  if (!(await consumeAmendmentRateLimit("amendment_metadata", tokenHash))) return null;
  const supabase = createServiceRoleClient();
  const { data: amendment } = await supabase
    .from("booking_amendments")
    .select("business_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (
    !amendment ||
    amendment.status === "REVOKED" ||
    (amendment.status === "PENDING_CUSTOMER" &&
      new Date(amendment.expires_at).getTime() <= Date.now())
  ) {
    return null;
  }
  const { data: business } = await supabase
    .from("businesses")
    .select("name, logo_path")
    .eq("id", amendment.business_id)
    .maybeSingle();
  return business ?? null;
}

export async function recordPublicAmendmentOpen(token: string) {
  if (
    !canUseServiceRoleClient() ||
    !isPlausibleAmendmentToken(token)
  ) {
    return;
  }
  const tokenHash = hashAmendmentToken(token);
  if (!(await consumeAmendmentRateLimit("amendment_open", tokenHash))) return;
  await createServiceRoleClient().rpc("record_booking_amendment_open", {
    p_token_hash: tokenHash,
  });
}

export async function confirmPublicAmendment(
  token: string,
): Promise<PublicAmendmentView> {
  if (!canUseServiceRoleClient() || !isPlausibleAmendmentToken(token)) {
    return { status: "unavailable" } satisfies PublicAmendmentView;
  }
  const tokenHash = hashAmendmentToken(token);
  if (!(await consumeAmendmentRateLimit("amendment_confirm", tokenHash))) {
    return { status: "rate_limited" } satisfies PublicAmendmentView;
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("confirm_booking_amendment_by_token_hash", {
    p_token_hash: tokenHash,
  });
  if (error) return { status: "unavailable" } satisfies PublicAmendmentView;
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
