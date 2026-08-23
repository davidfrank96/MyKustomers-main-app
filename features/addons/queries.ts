import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { deriveEffectiveBookingTotals } from "@/features/addons/totals";

type AddonRow = Database["public"]["Tables"]["booking_addons"]["Row"];
type AddonLinkRow =
  Database["public"]["Tables"]["booking_addon_confirmation_links"]["Row"];

export type BookingAddonItem = AddonRow & {
  latestLink: AddonLinkRow | null;
  requestEmailStatus: Database["public"]["Enums"]["email_event_status"] | null;
  confirmationEmailStatus: Database["public"]["Enums"]["email_event_status"] | null;
};

export type BookingAddonSummary = {
  items: BookingAddonItem[];
  totalAmountMinor: number;
  depositAmountMinor: number;
  balanceAmountMinor: number;
  confirmedAddonCount: number;
  hasAwaitingAddon: boolean;
};

export async function getBookingAddonSummary(
  businessId: string,
  bookingId: string,
  booking: { total_amount_minor: number; deposit_amount_minor: number },
): Promise<BookingAddonSummary> {
  const emptyTotals = deriveEffectiveBookingTotals(booking, []);
  if (!canUseServiceRoleClient()) {
    return { items: [], ...emptyTotals, hasAwaitingAddon: false };
  }
  const supabase = createServiceRoleClient();
  const [{ data: addons }, { data: links }, { data: emailEvents }] = await Promise.all([
    supabase
      .from("booking_addons")
      .select("*")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booking_addon_confirmation_links")
      .select("*")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    supabase
      .from("email_events")
      .select("booking_addon_id, booking_addon_confirmation_link_id, event_type, status")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .not("booking_addon_id", "is", null),
  ]);
  const rows = addons ?? [];
  const items = rows.map((addon) => {
    const addonLinks = (links ?? []).filter((link) => link.booking_addon_id === addon.id);
    const latestLink = addonLinks.at(-1) ?? null;
    return {
      ...addon,
      latestLink,
      requestEmailStatus:
        emailEvents
          ?.filter(
            (event) =>
              event.booking_addon_id === addon.id &&
              event.event_type === "BOOKING_ADDON_REQUESTED",
          )
          .at(-1)?.status ?? null,
      confirmationEmailStatus:
        emailEvents?.find(
          (event) =>
            event.booking_addon_id === addon.id &&
            event.event_type === "BOOKING_ADDON_CONFIRMED",
        )?.status ?? null,
    };
  });
  return {
    items,
    ...deriveEffectiveBookingTotals(booking, rows),
    hasAwaitingAddon: rows.some((addon) => addon.status === "AWAITING_CUSTOMER"),
  };
}
