import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import {
  confirmationRateLimitBucket,
  consumeConfirmationRateLimit,
} from "@/features/confirmation-links/rate-limit";
import {
  hashConfirmationToken,
  isPlausibleConfirmationToken,
} from "@/features/confirmation-links/token";
import type {
  PublicConfirmationBooking,
  PublicConfirmationStatus,
  PublicConfirmationView,
} from "@/features/confirmation-links/public-types";
import { confirmationContactSchema } from "@/features/confirmation-links/validation";
import { deliverEmailEvent } from "@/lib/email/outbox";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublicConfirmationView(value: unknown): PublicConfirmationView {
  if (!isRecord(value) || typeof value.status !== "string") {
    return { status: "unavailable" };
  }

  const status = value.status as PublicConfirmationStatus;

  if (!isRecord(value.booking)) {
    return { status };
  }

  return {
    status,
    booking: value.booking as PublicConfirmationBooking,
  };
}

export async function getPublicConfirmationView(
  token: string,
): Promise<PublicConfirmationView> {
  const bucket = await confirmationRateLimitBucket("lookup");
  const allowed = await consumeConfirmationRateLimit("lookup", bucket);

  if (!allowed) {
    return { status: "rate_limited" };
  }

  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return { status: "unavailable" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_confirmation_public_view", {
    p_token_hash: hashConfirmationToken(token),
  });

  if (error) {
    return { status: "unavailable" };
  }

  return parsePublicConfirmationView(data);
}

export type PublicConfirmationMetadata = {
  businessName: string;
  businessLogoPath: string | null;
};

export async function getPublicConfirmationMetadata(
  token: string,
): Promise<PublicConfirmationMetadata | null> {
  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return null;
  }

  const bucket = await confirmationRateLimitBucket("metadata");
  const allowed = await consumeConfirmationRateLimit("metadata", bucket);
  if (!allowed) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data: link, error: linkError } = await supabase
    .from("confirmation_links")
    .select("business_id, booking_id, expires_at, revoked_at, used_at")
    .eq("token_hash", hashConfirmationToken(token))
    .maybeSingle();

  if (
    linkError ||
    !link ||
    link.revoked_at ||
    (!link.used_at && new Date(link.expires_at).getTime() <= Date.now())
  ) {
    return null;
  }

  const [{ data: booking }, { data: business }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status")
      .eq("id", link.booking_id)
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
    !business ||
    (!link.used_at && booking.status !== "AWAITING_CUSTOMER")
  ) {
    return null;
  }

  return {
    businessName: business.name,
    businessLogoPath: business.logo_path,
  };
}

export async function recordPublicConfirmationOpen(token: string) {
  const bucket = await confirmationRateLimitBucket("open");
  const allowed = await consumeConfirmationRateLimit("open", bucket);

  if (!allowed || !canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return;
  }

  const supabase = createServiceRoleClient();
  await supabase.rpc("record_confirmation_link_open", {
    p_token_hash: hashConfirmationToken(token),
  });
}

export async function confirmPublicBooking(
  token: string,
  contactInput: unknown,
): Promise<
  PublicConfirmationView & {
    fieldErrors?: { contactEmail?: string[]; contactPhone?: string[] };
  }
> {
  const contact = confirmationContactSchema.safeParse(contactInput);
  if (!contact.success) {
    return {
      status: "invalid_contact",
      fieldErrors: contact.error.flatten().fieldErrors,
    };
  }

  const bucket = await confirmationRateLimitBucket("confirm");
  const allowed = await consumeConfirmationRateLimit("confirm", bucket);

  if (!allowed) {
    return { status: "rate_limited" };
  }

  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return { status: "unavailable" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("confirm_booking_by_token_hash", {
    p_token_hash: hashConfirmationToken(token),
    p_contact_email: contact.data.contactEmail,
    p_contact_phone: contact.data.contactPhone ?? null,
  });

  if (error) {
    return { status: "unavailable" };
  }

  if (
    isRecord(data) &&
    data.status === "confirmed" &&
    typeof data.email_event_id === "string"
  ) {
    await deliverEmailEvent(data.email_event_id);
  }

  const parsed = parsePublicConfirmationView(data);
  return parsed.status === "confirmed" ? { status: "confirmed" } : parsed;
}
