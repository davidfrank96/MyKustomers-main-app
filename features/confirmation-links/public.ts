import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { consumeConfirmationRateLimit } from "@/features/confirmation-links/rate-limit";
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
  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return { status: "unavailable" };
  }

  const tokenHash = hashConfirmationToken(token);
  const allowed = await consumeConfirmationRateLimit("lookup", tokenHash);

  if (!allowed) {
    return { status: "rate_limited" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_confirmation_public_view", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { status: "unavailable" };
  }

  return parsePublicConfirmationView(data);
}

export type PublicConfirmationMetadata = {
  previewId: string;
  businessName: string;
  businessLogoPath: string | null;
};

export async function getPublicConfirmationMetadata(
  token: string,
): Promise<PublicConfirmationMetadata | null> {
  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return null;
  }

  const tokenHash = hashConfirmationToken(token);
  return readPublicConfirmationMetadata("token_hash", tokenHash);
}

// A preview record ID grants only this minimized, read-only business projection.
// It is never accepted by the customer view or confirmation mutation boundaries.
export async function getPublicConfirmationImageMetadata(
  previewId: string,
): Promise<PublicConfirmationMetadata | null> {
  if (
    !canUseServiceRoleClient() ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      previewId,
    )
  ) {
    return null;
  }
  return readPublicConfirmationMetadata("id", previewId);
}

async function readPublicConfirmationMetadata(
  column: "token_hash" | "id",
  value: string,
): Promise<PublicConfirmationMetadata | null> {
  const supabase = createServiceRoleClient();
  const { data: link, error: linkError } = await supabase
    .from("confirmation_links")
    .select("id, business_id, booking_id, expires_at, revoked_at, used_at")
    .eq(column, value)
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
    previewId: link.id,
    businessName: business.name,
    businessLogoPath:
      business.logo_path === `${link.business_id}/logo.webp` ? business.logo_path : null,
  };
}

export async function recordPublicConfirmationOpen(token: string) {
  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return;
  }

  const tokenHash = hashConfirmationToken(token);
  const allowed = await consumeConfirmationRateLimit("open", tokenHash);
  if (!allowed) return;

  const supabase = createServiceRoleClient();
  await supabase.rpc("record_confirmation_link_open", {
    p_token_hash: tokenHash,
  });
}

export async function confirmPublicBooking(
  token: string,
  contactInput: unknown,
): Promise<
  PublicConfirmationView & {
    fieldErrors?: { contactEmail?: string[]; contactPhone?: string[] };
    confirmation?: {
      businessName: string | null;
      contactEmail: string;
    };
  }
> {
  const contact = confirmationContactSchema.safeParse(contactInput);
  if (!contact.success) {
    return {
      status: "invalid_contact",
      fieldErrors: contact.error.flatten().fieldErrors,
    };
  }

  if (!canUseServiceRoleClient() || !isPlausibleConfirmationToken(token)) {
    return { status: "unavailable" };
  }

  const tokenHash = hashConfirmationToken(token);
  const allowed = await consumeConfirmationRateLimit("confirm", tokenHash);

  if (!allowed) {
    return { status: "rate_limited" };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("confirm_booking_by_token_hash", {
    p_token_hash: tokenHash,
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
    try {
      await deliverEmailEvent(data.email_event_id);
    } catch {
      // Confirmation is already committed. The durable outbox owns delivery recovery.
    }
  }

  const parsed = parsePublicConfirmationView(data);
  if (parsed.status !== "confirmed") {
    return parsed;
  }

  const businessId = isRecord(data) && typeof data.business_id === "string"
    ? data.business_id
    : null;
  const bookingId = isRecord(data) && typeof data.booking_id === "string"
    ? data.booking_id
    : null;
  let businessName: string | null = null;
  let persistedContactEmail = contact.data.contactEmail;

  if (businessId && bookingId) {
    const [{ data: business }, { data: confirmation }] = await Promise.all([
      supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("booking_confirmations")
        .select("contact_email")
        .eq("business_id", businessId)
        .eq("booking_id", bookingId)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    businessName = business?.name ?? null;
    persistedContactEmail = confirmation?.contact_email ?? persistedContactEmail;
  }

  return {
    status: "confirmed",
    confirmation: {
      businessName,
      contactEmail: persistedContactEmail,
    },
  };
}
