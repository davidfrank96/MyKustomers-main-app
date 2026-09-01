import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { PublicCapabilityOpenTracker } from "@/components/forms/public-capability-open-tracker";
import { PublicAddonForm } from "@/components/forms/public-addon-form";
import { BusinessLogo } from "@/components/shared/business-logo";
import { formatMoneyMinor } from "@/features/bookings/money";
import {
  getBusinessInstagramUrl,
  getBusinessLogoPublicUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";
import { getPublicAddonMetadata, getPublicAddonView } from "@/features/addons/public";
import { confirmPublicAddonAction } from "@/features/addons/public-actions";
import { safePublicAddonMessage } from "@/features/addons/messages";
import { buildPublicAddonMetadata } from "@/features/addons/metadata";
import type { PublicAddon } from "@/features/addons/public-types";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

export const dynamic = "force-dynamic";

type AddonPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: AddonPageProps): Promise<Metadata> {
  const { token } = await params;
  const metadata = await getPublicAddonMetadata(token);
  return buildPublicAddonMetadata({
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

function BusinessIdentity({ addon }: { addon: PublicAddon }) {
  const logoUrl = getBusinessLogoPublicUrl(addon.business_logo_path);
  const websiteUrl = getSafeBusinessWebsiteUrl(addon.business_website);
  const instagramUrl = getBusinessInstagramUrl(addon.business_instagram);
  return (
    <div className="flex items-center gap-4">
      <BusinessLogo name={addon.business_name} url={logoUrl} className="size-14" />
      <div className="min-w-0">
        <p className="break-words text-base font-semibold">{addon.business_name}</p>
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

function AddonTerms({ addon }: { addon: PublicAddon }) {
  return (
    <dl className="mt-5 divide-y divide-border border-y border-border">
      <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
        <dt className="text-sm font-medium">Addition</dt>
        <dd className="min-w-0 break-words text-sm leading-6">{addon.title}</dd>
      </div>
      <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
        <dt className="text-sm font-medium">Details</dt>
        <dd className="min-w-0 break-words text-sm leading-6">
          {addon.description || "Not provided"}
        </dd>
      </div>
      <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
        <dt className="text-sm font-medium">Agreed amount</dt>
        <dd className="text-sm leading-6">
          {formatMoneyMinor(addon.total_amount_minor, addon.currency)}
        </dd>
      </div>
      <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
        <dt className="text-sm font-medium">Deposit recorded</dt>
        <dd className="text-sm leading-6">
          {formatMoneyMinor(addon.deposit_amount_minor, addon.currency)}
        </dd>
      </div>
      <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
        <dt className="text-sm font-medium">Add-on balance</dt>
        <dd className="text-sm leading-6">
          {formatMoneyMinor(addon.balance_amount_minor, addon.currency)}
        </dd>
      </div>
    </dl>
  );
}

export default async function AddonPage({ params, searchParams }: AddonPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const userAgent = (await headers()).get("user-agent");

  if (isSocialPreviewCrawler(userAgent)) {
    return (
      <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-sm font-medium text-muted-foreground">
            My Kustomers secure booking addition
          </p>
          <h1 className="mt-16 text-2xl font-semibold">Review a booking addition</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Open this secure link in your browser to review the request from the business
            that sent it.
          </p>
        </div>
      </main>
    );
  }

  const view = await getPublicAddonView(token);
  const addon = view.addon;
  const confirmed = query.confirmed === "1" || view.status === "already_confirmed";

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <p className="text-sm font-medium text-muted-foreground">
          My Kustomers secure booking addition
        </p>
        {addon ? (
          <>
            {view.status === "valid" ? (
              <PublicCapabilityOpenTracker endpoint="/api/addon/open" token={token} />
            ) : null}
            <div className="mt-5">
              <BusinessIdentity addon={addon} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight">
              {confirmed
                ? "Booking addition confirmed"
                : "Review an addition to your booking"}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              {confirmed
                ? `This additional scope is now confirmed for booking ${addon.booking_reference}.`
                : `${addon.business_name} has added something to your existing booking. Review the addition below and confirm if you agree.`}
            </p>
            <div className="mt-5 border-y border-border py-4 text-sm">
              <p>
                <span className="font-medium">Parent booking:</span> {addon.booking_title}{" "}
                ({addon.booking_reference})
              </p>
              <p className="mt-2">
                <span className="font-medium">Same delivery:</span>{" "}
                {formatDate(addon.scheduled_for)}
              </p>
              <p className="mt-2 text-muted-foreground">
                This addition shares the parent booking&apos;s delivery and does not
                replace the original agreement.
              </p>
            </div>
            <AddonTerms addon={addon} />
            {confirmed ? (
              <div
                className="mt-6 flex items-start gap-3 border-y border-border py-4"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">Add-on confirmed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The additional scope is now part of this booking.
                  </p>
                </div>
              </div>
            ) : view.status === "valid" ? (
              <PublicAddonForm action={confirmPublicAddonAction.bind(null, token)} />
            ) : (
              <p className="mt-6 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {safePublicAddonMessage(view.status)}
              </p>
            )}
          </>
        ) : (
          <div className="mt-16">
            <h1 className="text-2xl font-semibold">Booking addition unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {safePublicAddonMessage(view.status)}
            </p>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by My Kustomers
        </p>
      </div>
    </main>
  );
}
