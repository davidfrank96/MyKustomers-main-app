import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleArrowDown,
  Globe2,
  Hash,
  Instagram,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { BusinessLogo } from "@/components/shared/business-logo";
import { BrandLogo } from "@/components/shared/brand-logo";
import { formatMoneyMinor } from "@/features/bookings/money";
import {
  getBusinessInstagramUrl,
  getBusinessLogoPublicUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";
import type { PublicConfirmationBooking } from "@/features/confirmation-links/public-types";
import { getTransactionalEmailPlatformUrl } from "@/lib/email/templates/shared";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getWebsiteLabel(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

type DetailRowProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
};

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 border-b border-border py-4 last:border-b-0 sm:grid-cols-[2.25rem_minmax(9rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
      <span className="grid size-8 place-items-center text-primary">
        <Icon className="size-5" aria-hidden={true} />
      </span>
      <dt className="pt-1 text-sm font-medium leading-5 text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 pt-1 text-right text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere] sm:text-base">
        {value}
      </dd>
    </div>
  );
}

export function PublicConfirmationBookingSummary({
  booking,
}: {
  booking: PublicConfirmationBooking;
}) {
  return (
    <dl className="mt-7 rounded-lg border border-border bg-card px-4 shadow-sm sm:px-6">
      <DetailRow icon={UserRound} label="Customer" value={booking.customer_name} />
      <DetailRow icon={BriefcaseBusiness} label="Booking" value={booking.booking_title} />
      {booking.booking_description ? (
        <DetailRow
          icon={MessageSquareText}
          label="Details"
          value={booking.booking_description}
        />
      ) : null}
      <DetailRow
        icon={CalendarDays}
        label="Scheduled delivery"
        value={formatDateTime(booking.scheduled_for)}
      />
      <DetailRow
        icon={ReceiptText}
        label="Agreed total"
        value={formatMoneyMinor(booking.total_amount_minor, booking.currency)}
      />
      <DetailRow
        icon={CircleArrowDown}
        label="Deposit recorded"
        value={formatMoneyMinor(booking.deposit_amount_minor, booking.currency)}
      />
      <DetailRow
        icon={WalletCards}
        label="Balance remaining"
        value={formatMoneyMinor(booking.balance_amount_minor, booking.currency)}
      />
      <DetailRow icon={Hash} label="Reference" value={booking.booking_reference} />
    </dl>
  );
}

export function PublicConfirmationBusinessIdentity({
  booking,
}: {
  booking: PublicConfirmationBooking;
}) {
  const logoUrl = getBusinessLogoPublicUrl(booking.business_logo_path);
  const websiteUrl = getSafeBusinessWebsiteUrl(booking.business_website);
  const instagramUrl = getBusinessInstagramUrl(booking.business_instagram);

  return (
    <section aria-labelledby="confirmation-business-name" className="mt-8">
      <div className="flex items-start gap-4 sm:gap-5">
        <BusinessLogo
          name={booking.business_name}
          url={logoUrl}
          className="size-16 rounded-lg sm:size-20"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2
            id="confirmation-business-name"
            className="break-words text-xl font-semibold leading-tight sm:text-2xl"
          >
            {booking.business_name}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">
            Review and confirm your agreed booking details.
          </p>

          {websiteUrl || instagramUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${booking.business_name} on Instagram`}
                  className="inline-flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
                >
                  <Instagram className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">@{booking.business_instagram}</span>
                </a>
              ) : null}
              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${booking.business_name} website`}
                  className="inline-flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
                >
                  <Globe2 className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{getWebsiteLabel(websiteUrl)}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function MyKustomersAttribution() {
  const platformUrl = getTransactionalEmailPlatformUrl();

  return (
    <aside className="mt-4 rounded-lg border border-[#ccddd5] bg-[#f2f7f4] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
      <div className="flex items-start gap-3">
        <BrandLogo variant="icon" className="size-10" decorative />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Powered by <span className="text-primary">MyKustomers.com</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
            Manage bookings. Confirm digital receipts. Collect feedback.
          </p>
        </div>
      </div>
      <a
        href={platformUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-primary bg-card px-3 text-xs font-medium text-primary transition-colors hover:bg-muted sm:mt-0 sm:w-auto sm:shrink-0 sm:px-4 sm:text-sm"
      >
        Learn more about My Kustomers
        <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}

export function SecureConfirmationLabel() {
  return (
    <p className="inline-flex items-center gap-2 text-sm font-medium text-primary sm:text-base">
      <ShieldCheck className="size-5" aria-hidden="true" />
      Secure booking confirmation
    </p>
  );
}
