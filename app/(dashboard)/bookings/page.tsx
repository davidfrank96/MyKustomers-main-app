import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { ChevronDown, ListFilter, Plus } from "lucide-react";
import { BookingsMobileActions } from "@/components/bookings/bookings-mobile-actions";
import { BookingLoadMoreList } from "@/components/bookings/booking-load-more-list";
import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listBookingsForBusiness } from "@/features/bookings/queries";
import { getBookingStatusLabel } from "@/features/bookings/status";
import {
  bookingListFilters,
  parseBookingListParams,
  type BookingListFilter,
} from "@/features/bookings/validation";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type BookingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function BookingRowsFallback() {
  return (
    <Card
      className="divide-y divide-border overflow-hidden"
      role="status"
      aria-label="Loading booking rows"
    >
      <span className="sr-only">Loading booking rows</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="p-4" aria-hidden>
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
  businessId,
}: {
  resultPromise: ReturnType<typeof listBookingsForBusiness>;
  params: ReturnType<typeof parseBookingListParams>;
  businessId: string;
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
        <BookingLoadMoreList
          key={`${businessId}:${params.filter}:${params.q}`}
          initialBookings={result.bookings}
          total={result.total}
          q={params.q}
          filter={params.filter}
        />
      )}
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
    <WorkspacePage className="pb-52 sm:pb-52 lg:pb-7">
      <WorkspacePageHeader
        title="Bookings"
        description={`Track agreed work and delivery status for ${currentBusiness.name}.`}
        eyebrow={<Badge variant="outline">Bookings</Badge>}
        action={
          <Button asChild size="sm" className="h-10 px-3">
            <Link href={"/bookings/new" as Route}>
              <Plus className="size-4" aria-hidden="true" />
              New booking
            </Link>
          </Button>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <DebouncedSearchInput
            clearLabel="Clear booking search"
            density="compact"
            initialValue={params.q}
            placeholder="Search reference, title, or customer"
            label="Search bookings"
          />

          <div className="flex flex-wrap gap-2" aria-label="Quick booking filters">
            {(["all", "active", "today", "upcoming", "overdue"] as const).map(
              (filter) => (
                <Button
                  key={filter}
                  asChild
                  variant={params.filter === filter ? "primary" : "secondary"}
                  size="sm"
                  className="h-10"
                >
                  <Link href={filterHref(filter, params.q)}>{filterLabel(filter)}</Link>
                </Button>
              ),
            )}
          </div>
          <details className="group rounded-md border border-border bg-background/60">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <ListFilter className="size-4 text-muted-foreground" aria-hidden="true" />
                More statuses
              </span>
              <ChevronDown
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div
              className="flex flex-wrap gap-2 border-t border-border p-3"
              aria-label="Booking status filters"
            >
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
        <BookingResults
          resultPromise={resultPromise}
          params={params}
          businessId={currentBusiness.id}
        />
      </Suspense>
      <BookingsMobileActions />
    </WorkspacePage>
  );
}
