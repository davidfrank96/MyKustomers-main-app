import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import { formatMoneyMinor } from "@/features/bookings/money";
import { getPublicConfirmationView } from "@/features/confirmation-links/public";
import { confirmPublicBookingAction } from "@/features/confirmation-links/public-actions";
import { safePublicConfirmationMessage } from "@/features/confirmation-links/messages";
import type { PublicConfirmationBooking } from "@/features/confirmation-links/public-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Confirmation",
  robots: {
    index: false,
    follow: false,
  },
};

type ConfirmationPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-base font-medium text-foreground">{value}</dd>
    </div>
  );
}

function BookingSummary({ booking }: { booking: PublicConfirmationBooking }) {
  return (
    <dl className="mt-5 rounded-lg border border-border bg-card px-4">
      <DetailRow label="Customer" value={booking.customer_name} />
      <DetailRow label="Booking" value={booking.booking_title} />
      {booking.booking_description ? (
        <DetailRow label="Details" value={booking.booking_description} />
      ) : null}
      <DetailRow label="Scheduled" value={formatDateTime(booking.scheduled_for)} />
      <DetailRow
        label="Agreed total"
        value={formatMoneyMinor(booking.total_amount_minor, booking.currency)}
      />
      <DetailRow
        label="Deposit recorded"
        value={formatMoneyMinor(booking.deposit_amount_minor, booking.currency)}
      />
      <DetailRow
        label="Balance remaining"
        value={formatMoneyMinor(booking.balance_amount_minor, booking.currency)}
      />
      <DetailRow label="Reference" value={booking.booking_reference} />
    </dl>
  );
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const view = await getPublicConfirmationView(token);
  const booking = view.booking;
  const confirmed = query.confirmed === "1" || view.status === "already_confirmed";

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <p className="text-sm font-medium text-muted-foreground">My Customers</p>

        {booking ? (
          <>
            <h1 className="mt-5 text-3xl font-semibold leading-tight">
              {confirmed ? "Booking confirmed" : "Confirm booking"}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {confirmed
                ? `Your booking has been confirmed with ${booking.business_name}.`
                : `Review the details agreed with ${booking.business_name}.`}
            </p>

            <BookingSummary booking={booking} />

            {confirmed ? (
              <div className="mt-6 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Confirmed</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {booking.contact_email_masked
                        ? `We'll send a confirmation to ${booking.contact_email_masked}.`
                        : "No My Customers account is required."}
                    </p>
                  </div>
                </div>
              </div>
            ) : view.status === "valid" ? (
              <PublicConfirmationForm
                action={confirmPublicBookingAction.bind(null, token)}
              />
            ) : (
              <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                {safePublicConfirmationMessage(view.status)}
              </p>
            )}
          </>
        ) : (
          <div className="mt-16 rounded-lg border border-border bg-card p-5">
            <h1 className="text-2xl font-semibold leading-tight">
              Confirmation unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {safePublicConfirmationMessage(view.status)}
            </p>
          </div>
        )}

        {query.attempt === "failed" ? (
          <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            The booking could not be confirmed with this link.
          </p>
        ) : null}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by My Customers
        </p>
      </div>
    </main>
  );
}
