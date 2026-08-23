import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { PublicCapabilityOpenTracker } from "@/components/forms/public-capability-open-tracker";
import { PublicAmendmentForm } from "@/components/forms/public-amendment-form";
import { BusinessLogo } from "@/components/shared/business-logo";
import { formatMoneyMinor } from "@/features/bookings/money";
import {
  getBusinessInstagramUrl,
  getBusinessLogoPublicUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";
import {
  amendmentFieldLabels,
  type AmendableBookingField,
} from "@/features/amendments/terms";
import {
  getPublicAmendmentMetadata,
  getPublicAmendmentView,
} from "@/features/amendments/public";
import { confirmPublicAmendmentAction } from "@/features/amendments/public-actions";
import { safePublicAmendmentMessage } from "@/features/amendments/messages";
import { buildPublicAmendmentMetadata } from "@/features/amendments/metadata";
import type { AmendmentTerms, PublicAmendment } from "@/features/amendments/public-types";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

export const dynamic = "force-dynamic";

type AmendmentPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: AmendmentPageProps): Promise<Metadata> {
  const { token } = await params;
  const metadata = await getPublicAmendmentMetadata(token);
  return buildPublicAmendmentMetadata({
    token,
    businessName: metadata?.name,
    businessLogoPath: metadata?.logo_path,
  });
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function termValue(field: AmendableBookingField, terms: AmendmentTerms) {
  if (field === "scheduled_for") return formatDate(terms.scheduled_for);
  if (field === "total_amount_minor" || field === "deposit_amount_minor") {
    return formatMoneyMinor(terms[field], terms.currency);
  }
  if (field === "description") return terms.description || "Not provided";
  return String(terms[field]);
}

function BusinessIdentity({ amendment }: { amendment: PublicAmendment }) {
  const logoUrl = getBusinessLogoPublicUrl(amendment.business_logo_path);
  const websiteUrl = getSafeBusinessWebsiteUrl(amendment.business_website);
  const instagramUrl = getBusinessInstagramUrl(amendment.business_instagram);
  return (
    <div className="flex items-center gap-4">
      <BusinessLogo name={amendment.business_name} url={logoUrl} className="size-14" />
      <div className="min-w-0">
        <p className="break-words text-base font-semibold">{amendment.business_name}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Visit website
            </a>
          ) : null}
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Instagram
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChangeDiff({ amendment }: { amendment: PublicAmendment }) {
  return (
    <dl className="mt-5 divide-y divide-border border-y border-border">
      {amendment.changed_fields.map((field) => (
        <div key={field} className="grid gap-3 py-4 sm:grid-cols-[9rem_1fr_1fr]">
          <dt className="text-sm font-medium">{amendmentFieldLabels[field]}</dt>
          <dd className="min-w-0 break-words text-sm leading-6">
            <span className="block text-xs font-medium text-muted-foreground">
              Current
            </span>
            {termValue(field, amendment.current_terms)}
          </dd>
          <dd className="min-w-0 break-words text-sm leading-6">
            <span className="block text-xs font-medium text-muted-foreground">
              Proposed
            </span>
            {termValue(field, amendment.proposed_terms)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AmendmentPage({
  params,
  searchParams,
}: AmendmentPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const userAgent = (await headers()).get("user-agent");

  if (isSocialPreviewCrawler(userAgent)) {
    return (
      <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-sm font-medium text-muted-foreground">
            My Customers secure booking update
          </p>
          <h1 className="mt-16 text-2xl font-semibold">Review booking changes</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Open this secure link in your browser to review the request from the business
            that sent it.
          </p>
        </div>
      </main>
    );
  }

  const view = await getPublicAmendmentView(token);
  const amendment = view.amendment;
  const confirmed = query.confirmed === "1" || view.status === "already_confirmed";

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <p className="text-sm font-medium text-muted-foreground">
          My Customers secure booking update
        </p>
        {amendment ? (
          <>
            {view.status === "valid" ? (
              <PublicCapabilityOpenTracker endpoint="/api/amendment/open" token={token} />
            ) : null}
            <div className="mt-5">
              <BusinessIdentity amendment={amendment} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight">
              {confirmed ? "Booking changes confirmed" : "Review booking changes"}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {confirmed
                ? `The approved changes are now effective for booking ${amendment.booking_reference}.`
                : `${amendment.business_name} has proposed the changes below for booking ${amendment.booking_reference}.`}
            </p>
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6">
              Reason: {amendment.reason}
            </p>
            <ChangeDiff amendment={amendment} />
            {confirmed ? (
              <div
                className="mt-6 flex items-start gap-3 border-y border-border py-4"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">Changes confirmed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The proposed values now replace the previous values for this booking.
                  </p>
                </div>
              </div>
            ) : view.status === "valid" ? (
              <PublicAmendmentForm
                action={confirmPublicAmendmentAction.bind(null, token)}
              />
            ) : (
              <p className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {safePublicAmendmentMessage(view.status)}
              </p>
            )}
          </>
        ) : (
          <div className="mt-16">
            <h1 className="text-2xl font-semibold">Booking changes unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {safePublicAmendmentMessage(view.status)}
            </p>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by My Customers
        </p>
      </div>
    </main>
  );
}
