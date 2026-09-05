import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import {
  isConfirmationShareMethod,
  type ConfirmationShareMethod,
} from "@/features/confirmation-links/share";
import { parseProviderDeliverySummary } from "@/features/provider-delivery/model";
import { createClient } from "@/lib/supabase/server";

export type ConfirmationLinkSummary = {
  id: string;
  status: "active" | "expired" | "revoked" | "used" | "none";
  createdAt: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  confirmedAt: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  emailStatus: "PENDING" | "SENDING" | "SENT" | "FAILED" | null;
  requestRecipientEmail: string | null;
  requestEmailStatus: "PENDING" | "SENDING" | "SENT" | "FAILED" | null;
  requestCreatedAt: string | null;
  firstOpenedAt: string | null;
  sharedAt: string | null;
  shareMethod: ConfirmationShareMethod | null;
};

export async function getConfirmationDeliveryForBooking(bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_confirmation_delivery", {
    p_booking_id: bookingId,
  });
  return error ? null : parseProviderDeliverySummary(data);
}

export async function getConfirmationLinkSummaryForBooking(
  businessId: string,
  bookingId: string,
): Promise<ConfirmationLinkSummary> {
  if (!canUseServiceRoleClient()) {
    return {
      id: "",
      status: "none",
      createdAt: null,
      expiresAt: null,
      usedAt: null,
      revokedAt: null,
      confirmedAt: null,
      contactEmail: null,
      contactPhone: null,
      emailStatus: null,
      requestRecipientEmail: null,
      requestEmailStatus: null,
      requestCreatedAt: null,
      firstOpenedAt: null,
      sharedAt: null,
      shareMethod: null,
    };
  }

  const supabase = createServiceRoleClient();
  const [
    { data: link },
    { data: confirmation },
    { data: emailEvent },
    { data: requestEvent },
  ] = await Promise.all([
    supabase
      .from("confirmation_links")
      .select("id, created_at, expires_at, used_at, revoked_at, first_opened_at")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("booking_confirmations")
      .select("confirmed_at, contact_email, contact_phone")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("email_events")
      .select("status")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .eq("event_type", "BOOKING_CONFIRMED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("email_events")
      .select("recipient_email, status, created_at")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .eq("event_type", "BOOKING_CONFIRMATION_REQUESTED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!link) {
    return {
      id: "",
      status: "none",
      createdAt: null,
      expiresAt: null,
      usedAt: null,
      revokedAt: null,
      confirmedAt: confirmation?.confirmed_at ?? null,
      contactEmail: confirmation?.contact_email ?? null,
      contactPhone: confirmation?.contact_phone ?? null,
      emailStatus: emailEvent?.status ?? null,
      requestRecipientEmail: requestEvent?.recipient_email ?? null,
      requestEmailStatus: requestEvent?.status ?? null,
      requestCreatedAt: requestEvent?.created_at ?? null,
      firstOpenedAt: null,
      sharedAt: null,
      shareMethod: null,
    };
  }

  const { data: shareEvent } = await supabase
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("business_id", businessId)
    .eq("event_type", "CONFIRMATION_SHARE_INITIATED")
    .contains("metadata", { confirmation_link_id: link.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shareMethod =
    shareEvent?.metadata &&
    typeof shareEvent.metadata === "object" &&
    !Array.isArray(shareEvent.metadata) &&
    "method" in shareEvent.metadata
      ? shareEvent.metadata.method
      : null;

  const now = Date.now();
  const status = link.used_at
    ? "used"
    : link.revoked_at
      ? "revoked"
      : new Date(link.expires_at).getTime() <= now
        ? "expired"
        : "active";

  return {
    id: link.id,
    status,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    usedAt: link.used_at,
    revokedAt: link.revoked_at,
    confirmedAt: confirmation?.confirmed_at ?? null,
    contactEmail: confirmation?.contact_email ?? null,
    contactPhone: confirmation?.contact_phone ?? null,
    emailStatus: emailEvent?.status ?? null,
    requestRecipientEmail: requestEvent?.recipient_email ?? null,
    requestEmailStatus: requestEvent?.status ?? null,
    requestCreatedAt: requestEvent?.created_at ?? null,
    firstOpenedAt: link.first_opened_at,
    sharedAt: shareEvent?.created_at ?? null,
    shareMethod: isConfirmationShareMethod(shareMethod) ? shareMethod : null,
  };
}
