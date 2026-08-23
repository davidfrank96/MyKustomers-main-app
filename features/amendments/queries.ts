import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import {
  isConfirmationShareMethod,
  type ConfirmationShareMethod,
} from "@/features/confirmation-links/share";

type AmendmentRow = Database["public"]["Tables"]["booking_amendments"]["Row"];

export type BookingAmendmentSummary = {
  latest: AmendmentRow | null;
  history: AmendmentRow[];
  displayStatus: "none" | "pending" | "expired" | "confirmed" | "revoked";
  requestEmailStatus: Database["public"]["Enums"]["email_event_status"] | null;
  confirmationEmailStatus: Database["public"]["Enums"]["email_event_status"] | null;
  sharedAt: string | null;
  shareMethod: ConfirmationShareMethod | null;
};

const emptySummary: BookingAmendmentSummary = {
  latest: null,
  history: [],
  displayStatus: "none",
  requestEmailStatus: null,
  confirmationEmailStatus: null,
  sharedAt: null,
  shareMethod: null,
};

function methodFromMetadata(metadata: Json | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const method = "method" in metadata ? metadata.method : null;
  return isConfirmationShareMethod(method) ? method : null;
}

export async function getBookingAmendmentSummary(
  businessId: string,
  bookingId: string,
): Promise<BookingAmendmentSummary> {
  if (!canUseServiceRoleClient()) return emptySummary;
  const supabase = createServiceRoleClient();
  const { data: history } = await supabase
    .from("booking_amendments")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  const rows = history ?? [];
  const latest = rows.at(-1) ?? null;
  if (!latest) return { ...emptySummary, history: rows };

  const [{ data: emailEvents }, { data: shareEvent }] = await Promise.all([
    supabase
      .from("email_events")
      .select("event_type, status")
      .eq("business_id", businessId)
      .eq("booking_amendment_id", latest.id),
    supabase
      .from("audit_logs")
      .select("created_at, metadata")
      .eq("business_id", businessId)
      .eq("event_type", "BOOKING_AMENDMENT_SHARE_INITIATED")
      .contains("metadata", { amendment_id: latest.id })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const request = emailEvents?.find(
    (event) => event.event_type === "BOOKING_AMENDMENT_REQUESTED",
  );
  const confirmed = emailEvents?.find(
    (event) => event.event_type === "BOOKING_AMENDMENT_CONFIRMED",
  );
  const displayStatus =
    latest.status === "CONFIRMED"
      ? "confirmed"
      : latest.status === "REVOKED"
        ? "revoked"
        : new Date(latest.expires_at).getTime() <= Date.now()
          ? "expired"
          : "pending";

  return {
    latest,
    history: rows,
    displayStatus,
    requestEmailStatus: request?.status ?? null,
    confirmationEmailStatus: confirmed?.status ?? null,
    sharedAt: shareEvent?.created_at ?? null,
    shareMethod: methodFromMetadata(shareEvent?.metadata),
  };
}
