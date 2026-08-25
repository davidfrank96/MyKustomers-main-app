import { AlertTriangle, CalendarClock } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { AdminFilterSelect } from "@/components/admin/admin-filter-select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  adminBookingFilters,
  formatOperationLabel,
  parseAdminBookingParams,
} from "@/features/admin/operations";
import { listAdminBookings } from "@/features/admin/queries";
import { formatMoneyMinor } from "@/features/bookings/money";

export const metadata: Metadata = { title: "Bookings | Platform administration" };

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  return value ? `${dateTimeFormatter.format(new Date(value))} UTC` : "Not scheduled";
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const params = parseAdminBookingParams((await searchParams) ?? {});
  const result = await listAdminBookings(params);

  return (
    <section aria-labelledby="admin-bookings-title" className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform Operations</p>
        <h1 id="admin-bookings-title" className="mt-2 text-3xl font-semibold">
          Bookings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Read-only booking lifecycle, scheduling, value, and exception context.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
        <DebouncedSearchInput
          clearLabel="Clear booking search"
          initialValue={params.q}
          label="Search platform bookings"
          placeholder="Search reference, title, business, or customer"
        />
        <AdminFilterSelect
          label="Booking state"
          param="filter"
          value={params.filter}
          options={adminBookingFilters.map((value) => ({
            value,
            label: formatOperationLabel(value),
          }))}
        />
      </div>

      {params.businessId ? (
        <p className="text-sm text-muted-foreground">
          Filtered to one business. <Link href="/admin/bookings" className="font-medium text-primary">Clear business filter</Link>
        </p>
      ) : null}

      {result.items.length === 0 ? (
        <EmptyState
          title="No bookings found."
          description="No booking records match the current search and filter."
        />
      ) : (
        <div className="space-y-3" data-admin-directory="bookings">
          {result.items.map((booking) => (
            <Link
              key={booking.id}
              href={`/admin/bookings/${booking.id}` as Route}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {booking.reference}
                    </span>
                    <Badge variant="outline">{formatOperationLabel(booking.status)}</Badge>
                    {booking.open_issue_count > 0 ? (
                      <Badge variant="accent">
                        <AlertTriangle className="mr-1 size-3.5" aria-hidden="true" />
                        {booking.open_issue_count} open
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-2 break-words font-semibold">{booking.title}</h2>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {booking.customer_name} · {booking.business.name}
                  </p>
                </div>
                <div className="shrink-0 text-sm leading-6 text-muted-foreground md:text-right">
                  <p className="font-medium text-foreground">
                    {formatMoneyMinor(
                      booking.effective_total_amount_minor,
                      booking.currency,
                    )}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {formatDate(booking.scheduled_for)}
                  </p>
                  <p>Created {formatDate(booking.created_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AdminPagination
        basePath="/admin/bookings"
        page={result.page}
        q={params.q}
        total={result.total}
        totalPages={result.totalPages}
        preservedParams={{
          filter: params.filter === "all" ? undefined : params.filter,
          business: params.businessId,
        }}
      />
    </section>
  );
}
