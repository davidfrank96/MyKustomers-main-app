import { createClient } from "@/lib/supabase/server";
import { getWhatsAppAccess } from "@/features/whatsapp/access";
import { whatsappStatusLabels } from "@/features/whatsapp/validation";
import { disableBookingWhatsApp } from "@/features/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Check, Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export async function BookingUpdates({
  businessId,
  bookingId,
}: {
  businessId: string;
  bookingId: string;
}) {
  const access = await getWhatsAppAccess(businessId);
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
  if (!access.entitled && !preferences.data && !events.data?.length) return null;
  if (preferences.error || events.error)
    return (
      <p className="text-sm text-muted-foreground">
        Customer update status is temporarily unavailable.
      </p>
    );
  const preference = preferences.data;
  const latestEvent = events.data?.[0];
  const state = preference?.disabled_at
    ? "Updates stopped"
    : !preference?.whatsapp_enabled
      ? "Not selected"
      : !access.available
        ? "Future updates paused"
        : "Selected";
  return (
    <section
      aria-labelledby="booking-updates-title"
      className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:space-y-6 sm:p-6"
    >
      <div className="space-y-1.5">
        <h2
          id="booking-updates-title"
          className="text-base font-semibold tracking-tight sm:text-lg"
        >
          Customer updates
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose how the customer receives updates for this booking.
        </p>
      </div>
      <dl className="grid min-w-0 auto-rows-fr gap-3">
        <ChannelSummary
          label="Email"
          description="Get booking updates via email."
          status={preference?.email_enabled === false ? "Not selected" : "Selected"}
          icon={<Mail className="size-6" aria-hidden="true" />}
        />
        <ChannelSummary
          label="WhatsApp"
          description="Get booking updates via WhatsApp."
          status={state}
          icon={
            <span className="relative size-6" aria-hidden="true">
              <MessageCircle className="size-6" />
              <Phone className="absolute left-1.5 top-1.5 size-3" />
            </span>
          }
        />
      </dl>
      {latestEvent && (
        <dl className="grid gap-1 border-t border-border pt-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
          <dt>Latest WhatsApp update</dt>
          <dd className="break-words">
            {whatsappStatusLabels[latestEvent.status] ?? "Status unavailable"}
          </dd>
        </dl>
      )}
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

function ChannelSummary({
  label,
  description,
  status,
  icon,
}: {
  label: string;
  description: string;
  status: string;
  icon: ReactNode;
}) {
  const selected = status === "Selected";
  return (
    <div
      className={cn(
        "grid min-h-24 min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-3 rounded-xl border p-4 sm:min-h-28 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:p-5",
        selected ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-card",
      )}
    >
      <dt className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12",
            selected
              ? "bg-primary/[0.07] text-primary"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 space-y-1">
          <span className="block text-sm font-semibold sm:text-base">{label}</span>
          <span className="block text-sm leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
      </dt>
      <dd className="pl-[52px] sm:pl-0">
        <span
          className={cn(
            "inline-flex h-8 min-w-28 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold",
            selected
              ? "bg-primary/[0.08] text-primary"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          {selected && <Check className="size-4 shrink-0" aria-hidden="true" />}
          {status}
        </span>
      </dd>
    </div>
  );
}
