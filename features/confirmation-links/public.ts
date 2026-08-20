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
