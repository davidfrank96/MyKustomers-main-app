import { createClient } from "@/lib/supabase/server";
import { whatsappConfig, whatsappAvailable } from "@/lib/whatsapp/config";
import { whatsappStatusLabels } from "@/features/whatsapp/validation";
import { disableBookingWhatsApp } from "@/features/whatsapp/actions";
import { Button } from "@/components/ui/button";

export async function BookingUpdates({
  businessId,
  bookingId,
}: {
  businessId: string;
  bookingId: string;
}) {
  if (!whatsappConfig().pilotBusinessIds.includes(businessId)) return null;
  const db = await createClient();
  const [preferences, events] = await Promise.all([
    db
      .from("booking_communication_preferences")
      .select("email_enabled,whatsapp_enabled,disabled_at")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .maybeSingle(),
    db
      .from("whatsapp_events")
      .select("id,status,event_type,created_at")
      .eq("business_id", businessId)
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (preferences.error || events.error)
    return (
      <p className="text-sm text-muted-foreground">
        Customer update status is temporarily unavailable.
      </p>
    );
  const preference = preferences.data;
  const state = !whatsappAvailable(businessId)
    ? "Unavailable — queued updates are paused"
    : preference?.disabled_at
      ? "Updates stopped"
      : !preference?.whatsapp_enabled
        ? "Not selected"
        : events.data?.[0]
          ? (whatsappStatusLabels[events.data[0].status] ?? "Status unavailable")
          : "Ready for booking updates";
  return (
    <section
      aria-labelledby="booking-updates-title"
      className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="booking-updates-title" className="font-semibold">
        Customer updates
      </h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt>Email</dt>
        <dd>{preference?.email_enabled === false ? "Not selected" : "Selected"}</dd>
        <dt>WhatsApp</dt>
        <dd className="break-words">{state}</dd>
      </dl>
      {preference?.whatsapp_enabled && (
        <form action={disableBookingWhatsApp.bind(null, bookingId)}>
          <Button
            variant="secondary"
            type="submit"
            className="h-auto min-h-11 whitespace-normal text-left"
          >
            Stop WhatsApp updates
          </Button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Stops future WhatsApp updates for this booking. A message already sending may
            still arrive.
          </p>
        </form>
      )}
    </section>
  );
}
