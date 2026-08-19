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

export async function confirmPublicBooking(token: string): Promise<PublicConfirmationView> {
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
  });

  if (error) {
    return { status: "unavailable" };
  }

  const parsed = parsePublicConfirmationView(data);
  return parsed.status === "confirmed" ? { status: "confirmed" } : parsed;
}
