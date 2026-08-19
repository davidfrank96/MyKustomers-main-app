import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAnalyticsRange } from "@/features/analytics/date-ranges";
import { formatCurrencyMinor, formatInteger } from "@/features/analytics/format";
import { getBusinessInsights } from "@/features/analytics/queries";
import type { BookingWithCustomer } from "@/features/bookings/queries";
import { getBookingDashboardStats } from "@/features/bookings/queries";
import { countActiveCustomersForBusiness } from "@/features/customers/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function WorkQueue({
  title,
  bookings,
  empty,
}: {
  title: string;
  bookings: BookingWithCustomer[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}` as Route}
                className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted"
              >
                <p className="text-sm font-medium">{booking.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {booking.customer?.name ?? "Customer unavailable"} · {formatDate(booking.scheduled_for)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }
  const monthRange = parseAnalyticsRange({ range: "this_month" });
  const [customerCount, bookingStats, monthInsights] = await Promise.all([
    countActiveCustomersForBusiness(currentBusiness.id),
    getBookingDashboardStats(currentBusiness.id),
    getBusinessInsights(currentBusiness.id, monthRange).catch(() => null),
  ]);
  const completedValueSummary =
    !monthInsights
      ? "Unavailable"
      : monthInsights.value.completed.length === 0
      ? "No completed value"
      : monthInsights.value.completed
          .map((metric) => formatCurrencyMinor(metric.amountMinor, metric.currency))
          .join(" · ");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Authenticated workspace</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your business workspace is ready for customer and booking operations.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>{currentBusiness.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">
              Category: {currentBusiness.category}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Slug: {currentBusiness.slug}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Active customer records: {customerCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Open booking records: {bookingStats.activeBookings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Due today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Scheduled today: {bookingStats.dueTodayBookings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Past scheduled open bookings: {bookingStats.overdueBookings}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight">Operational work</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Current tenant bookings that need attention.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={"/bookings?filter=today" as Route}>View today</Link>
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkQueue
            title="Due today"
            bookings={bookingStats.dueToday}
            empty="No bookings are scheduled for today."
          />
          <WorkQueue
            title="Overdue"
            bookings={bookingStats.overdue}
            empty="No overdue operational bookings."
          />
          <WorkQueue
            title="In progress"
            bookings={bookingStats.inProgress}
            empty="No bookings are currently in progress."
          />
          <WorkQueue
            title="Ready"
            bookings={bookingStats.ready}
            empty="No bookings are marked ready."
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold leading-tight">This month</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A short analytics summary from completed bookings, feedback, and recorded values.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={"/insights?range=this_month" as Route}>Open insights</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Completed this month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {monthInsights
                  ? `${formatInteger(monthInsights.bookings.completed.value)} bookings completed.`
                  : "Insights unavailable."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completed booking value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {completedValueSummary}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feedback received</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {monthInsights
                  ? `${formatInteger(monthInsights.feedback.responses.value)} private responses.`
                  : "Insights unavailable."}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
