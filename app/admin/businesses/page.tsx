import { CalendarClock, CalendarDays, ContactRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { BusinessLogo } from "@/components/shared/business-logo";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  parseAdminDirectoryParams,
  type AdminBusinessSummary,
} from "@/features/admin/directory";
import { listAdminBusinesses } from "@/features/admin/queries";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";

export const metadata: Metadata = { title: "Businesses | Platform administration" };

type AdminBusinessesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function ownerIdentity(owner: { display_name: string | null; email: string | null }) {
  if (owner.display_name && owner.email) return `${owner.display_name} (${owner.email})`;
  return owner.display_name ?? owner.email ?? "Profile unavailable";
}

function businessMetrics(business: AdminBusinessSummary) {
  return [
    { label: "Members", value: business.member_count, icon: Users },
    { label: "Customers", value: business.customer_count, icon: ContactRound },
    { label: "Bookings", value: business.booking_count, icon: CalendarDays },
    { label: "Active", value: business.active_booking_count, icon: CalendarClock },
  ] satisfies Array<{ icon: LucideIcon; label: string; value: number }>;
}

export default async function AdminBusinessesPage({
  searchParams,
}: AdminBusinessesPageProps) {
  const params = parseAdminDirectoryParams((await searchParams) ?? {});
  const result = await listAdminBusinesses(params);

  return (
    <section aria-labelledby="admin-businesses-title" className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform Support</p>
        <h1 id="admin-businesses-title" className="mt-2 text-3xl font-semibold">
          Businesses
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Read-only business identity, ownership, and operational record counts.
        </p>
      </header>

      <DebouncedSearchInput
        clearLabel="Clear business search"
        initialValue={params.q}
        label="Search businesses"
        placeholder="Search name, slug, email, phone, or website"
      />

      {result.items.length === 0 ? (
        <EmptyState
          title={params.q ? `No businesses match "${params.q}".` : "No businesses found."}
          description="Try a different business identity search."
        />
      ) : (
        <div className="space-y-3" data-admin-directory="businesses">
          {result.items.map((business) => (
            <Link
              key={business.id}
              href={`/admin/businesses/${business.id}` as Route}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            >
              <div className="flex min-w-0 items-start gap-4">
                <BusinessLogo
                  name={business.name}
                  url={getBusinessLogoPublicUrl(business.logo_path)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <h2 className="break-words font-semibold">{business.name}</h2>
                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        /{business.slug}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-muted-foreground">
                      Created {dateFormatter.format(new Date(business.created_at))}
                    </p>
                  </div>
                  <div className="mt-3 text-sm leading-6">
                    <span className="font-medium">
                      {business.owners.length === 1 ? "Owner" : "Owners"}:
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {business.owners.length > 0
                        ? business.owners.map(ownerIdentity).join(", ")
                        : "No active owner"}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-4">
                    {businessMetrics(business).map(({ label, value, icon: Icon }) => (
                      <div key={label}>
                        <dt className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon className="size-4" aria-hidden="true" />
                          {label}
                        </dt>
                        <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AdminPagination
        basePath="/admin/businesses"
        page={result.page}
        q={params.q}
        total={result.total}
        totalPages={result.totalPages}
      />
    </section>
  );
}
