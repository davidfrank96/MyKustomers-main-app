import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Badge } from "@/components/ui/badge";
import { getAdminBusiness } from "@/features/admin/queries";
import {
  getBusinessInstagramUrl,
  getBusinessLogoPublicUrl,
  getSafeBusinessWebsiteUrl,
} from "@/features/businesses/logo-public";

export const metadata: Metadata = { title: "Business support | Platform administration" };

type AdminBusinessDetailPageProps = {
  params: Promise<{ businessId: string }>;
};

const uuidSchema = z.string().uuid();
const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function AdminBusinessDetailPage({
  params,
}: AdminBusinessDetailPageProps) {
  const parsedId = uuidSchema.safeParse((await params).businessId);
  if (!parsedId.success) notFound();

  const business = await getAdminBusiness(parsedId.data);
  if (!business) notFound();

  const website = getSafeBusinessWebsiteUrl(business.website);
  const instagram = getBusinessInstagramUrl(business.instagram);
  const metrics = [
    ["Customers", business.metrics.customers],
    ["Bookings", business.metrics.bookings],
    ["Active bookings", business.metrics.active_bookings],
    ["Completed", business.metrics.completed_bookings],
    ["Open issues", business.metrics.open_issues],
    ["Failed emails", business.metrics.failed_emails],
    ["Pending emails", business.metrics.pending_emails],
  ] as const;

  return (
    <section aria-labelledby="admin-business-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link
          href="/admin/businesses"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Businesses
        </Link>
        <div className="mt-5 flex min-w-0 items-start gap-4">
          <BusinessLogo
            name={business.name}
            url={getBusinessLogoPublicUrl(business.logo_path)}
            className="size-14"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="admin-business-title"
                className="break-words text-3xl font-semibold"
              >
                {business.name}
              </h1>
              <Badge variant="outline">Onboarded</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">/{business.slug}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="business-identity-title">
        <h2 id="business-identity-title" className="text-lg font-semibold">
          Business identity
        </h2>
        <dl className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Category", business.category],
            ["Business email", business.email ?? "Not provided"],
            ["Business phone", business.phone ?? "Not provided"],
            ["Created", dateFormatter.format(new Date(business.created_at))],
            [
              "Onboarding completed",
              dateFormatter.format(new Date(business.onboarding_completed_at)),
            ],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
          <div className="min-w-0 bg-card p-4">
            <dt className="text-sm text-muted-foreground">Public links</dt>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  Website <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {instagram ? (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  Instagram <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {!website && !instagram ? "Not provided" : null}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="business-operations-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="business-operations-title" className="text-lg font-semibold">
            Operational summary
          </h2>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <Link href={`/admin/bookings?business=${business.id}` as Route} className="text-primary">View bookings</Link>
            <Link href={`/admin/issues?business=${business.id}` as Route} className="text-primary">View issues</Link>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} data-admin-business-metric={label} className="bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="business-members-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="business-members-title" className="text-lg font-semibold">
            Memberships
          </h2>
          <p className="text-sm text-muted-foreground">
            {business.memberships.length} records
          </p>
        </div>
        {business.memberships.length === 0 ? (
          <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
            No memberships found.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {business.memberships.map((membership) => (
              <Link
                key={membership.user_id}
                href={`/admin/users/${membership.user_id}` as Route}
                className="grid gap-3 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3"
              >
                <div className="min-w-0">
                  <h3 className="break-words font-medium">
                    {membership.display_name ?? "Profile unavailable"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {membership.email ?? "Email unavailable"}
                  </p>
                </div>
                <Badge variant="outline">{membership.role.toUpperCase()}</Badge>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{membership.status.toUpperCase()}</p>
                  <p className="mt-1">
                    Joined {dateFormatter.format(new Date(membership.created_at))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
