import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";

export type ConfirmationLinkSummary = {
  id: string;
  status: "active" | "expired" | "revoked" | "used" | "none";
  createdAt: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  confirmedAt: string | null;
};

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
    };
  }

  const supabase = createServiceRoleClient();
  const { data: link } = await supabase
    .from("confirmation_links")
    .select("id, created_at, expires_at, used_at, revoked_at")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: confirmation } = await supabase
    .from("booking_confirmations")
    .select("confirmed_at")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link) {
    return {
      id: "",
      status: "none",
      createdAt: null,
      expiresAt: null,
      usedAt: null,
      revokedAt: null,
      confirmedAt: confirmation?.confirmed_at ?? null,
    };
  }

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
  };
}
