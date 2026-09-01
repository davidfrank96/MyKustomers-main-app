import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { PublicCapabilityOpenTracker } from "@/components/forms/public-capability-open-tracker";
import {
  MyKustomersAttribution,
  PublicConfirmationBookingSummary,
  PublicConfirmationBusinessIdentity,
  SecureConfirmationLabel,
} from "@/components/forms/public-confirmation-content";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import {
  getPublicConfirmationMetadata,
  getPublicConfirmationView,
} from "@/features/confirmation-links/public";
import { confirmPublicBookingAction } from "@/features/confirmation-links/public-actions";
import { safePublicConfirmationMessage } from "@/features/confirmation-links/messages";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { isSocialPreviewCrawler } from "@/features/confirmation-links/crawlers";

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

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const userAgent = (await headers()).get("user-agent");

  if (isSocialPreviewCrawler(userAgent)) {
    return (
      <main className="min-h-dvh bg-[#f2f3f0] px-4 py-6 text-foreground sm:px-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <SecureConfirmationLabel />
          <div className="mt-12 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h1 className="text-2xl font-semibold leading-tight">
              Secure order confirmation
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Open this secure link in your browser to review the request from the
              business that sent it.
            </p>
          </div>
          <MyKustomersAttribution />
        </div>
      </main>
    );
  }

  const view = await getPublicConfirmationView(token);
  const booking = view.booking;
  const confirmed = query.confirmed === "1" || view.status === "already_confirmed";

  return (
    <main className="min-h-dvh bg-[#f2f3f0] px-4 py-6 text-foreground sm:px-6 sm:py-10 lg:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <SecureConfirmationLabel />

        {booking ? (
          <>
            {view.status === "valid" ? (
              <PublicCapabilityOpenTracker
                endpoint="/api/confirmation/open"
                token={token}
              />
            ) : null}
            <PublicConfirmationBusinessIdentity booking={booking} />
            <h1 className="mt-10 text-3xl font-semibold leading-tight sm:text-4xl">
              {confirmed ? "Booking confirmed" : "Review your order"}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              {confirmed
                ? `Your booking has been confirmed with ${booking.business_name}.`
                : `${booking.business_name} has asked you to review and confirm the details below.`}
            </p>

            <PublicConfirmationBookingSummary booking={booking} />

            {confirmed ? (
              <div className="mt-6 rounded-lg border border-[#ccddd5] bg-[#f2f7f4] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">Confirmed</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {booking.contact_email_masked
                        ? `We'll send a confirmation to ${booking.contact_email_masked}.`
                        : "No My Kustomers account is required."}
                    </p>
                  </div>
                </div>
              </div>
            ) : view.status === "valid" ? (
              <PublicConfirmationForm
                action={confirmPublicBookingAction.bind(null, token)}
              />
            ) : (
              <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground shadow-sm">
                {safePublicConfirmationMessage(view.status)}
              </p>
            )}
          </>
        ) : (
          <div className="mt-12 rounded-lg border border-border bg-card p-5 shadow-sm">
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

        <MyKustomersAttribution />
      </div>
    </main>
  );
}
