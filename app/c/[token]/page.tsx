import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { ConfirmationOpenTracker } from "@/components/forms/confirmation-open-tracker";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import { BusinessLogo } from "@/components/shared/business-logo";
import { formatMoneyMinor } from "@/features/bookings/money";
import {
  getBusinessInstagramUrl,
  getBusinessLogoPublicUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";
import {
  getPublicConfirmationMetadata,
  getPublicConfirmationView,
} from "@/features/confirmation-links/public";
import { confirmPublicBookingAction } from "@/features/confirmation-links/public-actions";
import { safePublicConfirmationMessage } from "@/features/confirmation-links/messages";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";
import type { PublicConfirmationBooking } from "@/features/confirmation-links/public-types";

export const dynamic = "force-dynamic";

type ConfirmationPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: ConfirmationPageProps): Promise<Metadata> {
  const { token } = await params;
  const safeMetadata = await getPublicConfirmationMetadata(token);

  return buildPublicConfirmationMetadata({
    token,
    businessName: safeMetadata?.businessName,
    businessLogoPath: safeMetadata?.businessLogoPath,
  });
}

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

function BusinessIdentity({ booking }: { booking: PublicConfirmationBooking }) {
  const logoUrl = getBusinessLogoPublicUrl(booking.business_logo_path);
  const websiteUrl = getSafeBusinessWebsiteUrl(booking.business_website);
  const instagramUrl = getBusinessInstagramUrl(booking.business_instagram);

  return (
    <div className="flex items-center gap-4">
      <BusinessLogo name={booking.business_name} url={logoUrl} className="size-14" />
      <div className="min-w-0">
        <p className="break-words text-base font-semibold">{booking.business_name}</p>
        {websiteUrl || instagramUrl ? (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Visit website
              </a>
            ) : null}
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Instagram
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const userAgent = (await headers()).get("user-agent");

  if (isSocialPreviewCrawler(userAgent)) {
    return (
      <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
        <div className="mx-auto flex w-full max-w-xl flex-col">
          <p className="text-sm font-medium text-muted-foreground">
            My Customers secure confirmation
          </p>
          <div className="mt-16 rounded-lg border border-border bg-card p-5">
            <h1 className="text-2xl font-semibold leading-tight">
              Secure order confirmation
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Open this secure link in your browser to review the request from the
              business that sent it.
            </p>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Powered by My Customers
          </p>
        </div>
      </main>
    );
  }

  const view = await getPublicConfirmationView(token);
  const booking = view.booking;
  const confirmed = query.confirmed === "1" || view.status === "already_confirmed";

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <p className="text-sm font-medium text-muted-foreground">My Customers secure confirmation</p>

        {booking ? (
          <>
            {view.status === "valid" ? <ConfirmationOpenTracker token={token} /> : null}
            <div className="mt-5">
              <BusinessIdentity booking={booking} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight">
              {confirmed ? "Booking confirmed" : "Review your order"}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {confirmed
                ? `Your booking has been confirmed with ${booking.business_name}.`
                : `${booking.business_name} has asked you to review and confirm the details below.`}
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
