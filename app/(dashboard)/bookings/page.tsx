import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { ChevronDown, ChevronRight, ListFilter, Plus } from "lucide-react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import {
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyMinor, deriveBalanceMinor } from "@/features/bookings/money";
import { listBookingsForBusiness } from "@/features/bookings/queries";
import { getBookingStatusLabel, isBookingOverdue } from "@/features/bookings/status";
import {
  bookingListFilters,
  parseBookingListParams,
  type BookingListFilter,
} from "@/features/bookings/validation";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type BookingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function filterLabel(filter: BookingListFilter) {
  if (filter === "all") return "All";
  if (filter === "active") return "Active";
  if (filter === "today") return "Today";
  if (filter === "upcoming") return "Upcoming";
  if (filter === "overdue") return "Overdue";
  return getBookingStatusLabel(filter);
}

function filterHref(filter: BookingListFilter, q: string) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (q) {
    params.set("q", q);
  }
  return `/bookings?${params.toString()}` as Route;
}

function pageHref({
  filter,
  q,
  page,
}: {
  filter: BookingListFilter;
  q: string;
  page: number;
}) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  params.set("page", String(page));
  if (q) {
    params.set("q", q);
  }
  return `/bookings?${params.toString()}` as Route;
}

function BookingRowsFallback() {
  return (
    <Card className="divide-y divide-border overflow-hidden" role="status" aria-label="Loading booking rows">
      <span className="sr-only">Loading booking rows</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="p-4"
          aria-hidden
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-5 w-full max-w-xs" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
      ))}
    </Card>
  );
}

async function BookingResults({
  resultPromise,
  params,
}: {
  resultPromise: ReturnType<typeof listBookingsForBusiness>;
  params: ReturnType<typeof parseBookingListParams>;
}) {
  const result = await resultPromise;

  return (
    <>
      {result.bookings.length === 0 ? (
        <EmptyState
          title={params.q ? "No matching bookings." : "No bookings yet."}
          description={
            params.q
              ? "No saved bookings matched this search."
              : "Create a booking once a customer has agreed work with your business."
          }
          action={
            <Button asChild>
              <Link href={"/bookings/new" as Route}>
                <Plus className="size-4" aria-hidden="true" />
                New booking
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {result.bookings.map((booking) => {
            const balance = deriveBalanceMinor(
              booking.total_amount_minor,
              booking.deposit_amount_minor,
            );
            const overdue = isBookingOverdue({
              scheduledFor: booking.scheduled_for,
              status: booking.status,
            });

            return (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}` as Route}
                className="group block min-w-0 p-4 transition-colors hover:bg-muted/60 sm:px-5"
              >
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[0.6875rem] font-semibold text-muted-foreground sm:text-xs">
                        {booking.reference}
                      </span>
                      <BookingStatusBadge status={booking.status} overdue={overdue} />
                    </div>
                    <h2 className="mt-1.5 truncate text-sm font-semibold leading-5 sm:text-base">
                      {booking.title}
                    </h2>
                    <p className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                      {booking.customer?.name ?? "Customer unavailable"} ·{" "}
                      {formatDate(booking.scheduled_for)}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-right">
                    <div className="min-w-0 text-xs leading-5 text-muted-foreground sm:text-sm">
                      <p className="break-all font-medium text-foreground sm:break-words">
                        {formatMoneyMinor(booking.total_amount_minor, booking.currency)}
                      </p>
                      <p className="break-all sm:break-words">
                        Balance {formatMoneyMinor(balance, booking.currency)}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {result.bookings.length} of {result.total} bookings.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="secondary" size="sm" disabled={result.page <= 1}>
            <Link
              href={pageHref({
                filter: params.filter,
                q: params.q,
                page: result.page - 1,
              })}
            >
              Previous
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            size="sm"
            disabled={result.page >= result.totalPages}
          >
            <Link
              href={pageHref({
                filter: params.filter,
                q: params.q,
                page: result.page + 1,
              })}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const params = parseBookingListParams((await searchParams) ?? {});
  const resultPromise = listBookingsForBusiness(currentBusiness.id, params);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Bookings"
        description={`Track agreed work and delivery status for ${currentBusiness.name}.`}
        eyebrow={<Badge variant="outline">Bookings</Badge>}
        action={
          <Button asChild size="sm">
          <Link href={"/bookings/new" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden min-[375px]:inline">New booking</span>
            <span className="min-[375px]:hidden">New</span>
          </Link>
          </Button>
        }
      />

      <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <DebouncedSearchInput
              clearLabel="Clear booking search"
              initialValue={params.q}
              placeholder="Search reference, title, or customer"
              label="Search bookings"
            />

            <div className="flex flex-wrap gap-2" aria-label="Quick booking filters">
              {(["all", "active", "today", "upcoming", "overdue"] as const).map((filter) => (
                <Button
                  key={filter}
                  asChild
                  variant={params.filter === filter ? "primary" : "secondary"}
                  size="sm"
                >
                  <Link href={filterHref(filter, params.q)}>{filterLabel(filter)}</Link>
                </Button>
              ))}
            </div>
            <details className="group rounded-md border border-border bg-background/60">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <ListFilter className="size-4 text-muted-foreground" aria-hidden="true" />
                  More statuses
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="flex flex-wrap gap-2 border-t border-border p-3" aria-label="Booking status filters">
                {bookingListFilters.slice(5).map((filter) => (
                  <Button
                    key={filter}
                    asChild
                    variant={params.filter === filter ? "primary" : "secondary"}
                    size="sm"
                  >
                    <Link href={filterHref(filter, params.q)}>{filterLabel(filter)}</Link>
                  </Button>
                ))}
              </div>
            </details>
          </div>
      </Card>

      <Suspense fallback={<BookingRowsFallback />}>
        <BookingResults resultPromise={resultPromise} params={params} />
      </Suspense>
    </WorkspacePage>
  );
}
