import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const params = parseBookingListParams((await searchParams) ?? {});
  const result = await listBookingsForBusiness(currentBusiness.id, params);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <Badge variant="outline">Bookings</Badge>
          <div>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Bookings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track agreed customer work, recorded deposits, scheduled dates, and lifecycle
              status for {currentBusiness.name}.
            </p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-fit">
          <Link href={"/bookings/new" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            New booking
          </Link>
        </Button>
      </section>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <form action="/bookings" className="flex flex-col gap-3 sm:flex-row" role="search">
              <input type="hidden" name="filter" value={params.filter} />
              <Input
                name="q"
                defaultValue={params.q}
                placeholder="Search reference, title, or customer"
                aria-label="Search bookings"
              />
              <Button type="submit" variant="secondary" className="w-full sm:w-fit">
                <Search className="size-4" aria-hidden="true" />
                Search
              </Button>
            </form>

            <div className="flex flex-wrap gap-2" aria-label="Booking filters">
              {bookingListFilters.map((filter) => (
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
          </div>
        </CardContent>
      </Card>

      {result.bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet."
          description={
            params.q
              ? "No tenant-scoped bookings matched this search."
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
        <div className="grid gap-3">
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
                className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/70"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {booking.reference}
                      </span>
                      <Badge variant={overdue ? "accent" : "outline"}>
                        {overdue ? "Overdue" : getBookingStatusLabel(booking.status)}
                      </Badge>
                    </div>
                    <h2 className="mt-2 text-base font-semibold leading-6">{booking.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {booking.customer?.name ?? "Customer unavailable"} · {formatDate(booking.scheduled_for)}
                    </p>
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground md:text-right">
                    <p>Agreed total: {formatMoneyMinor(booking.total_amount_minor, booking.currency)}</p>
                    <p>Balance: {formatMoneyMinor(balance, booking.currency)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {result.bookings.length} of {result.total} bookings.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" disabled={result.page <= 1}>
            <Link href={pageHref({ filter: params.filter, q: params.q, page: result.page - 1 })}>
              Previous
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            size="sm"
            disabled={result.page >= result.totalPages}
          >
            <Link href={pageHref({ filter: params.filter, q: params.q, page: result.page + 1 })}>
              Next
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
