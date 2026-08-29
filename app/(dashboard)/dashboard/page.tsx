import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense, type ReactNode } from "react";
import { AlertCircle, CalendarDays, ChevronRight, Plus } from "lucide-react";
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceSectionHeader,
} from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseAnalyticsRange } from "@/features/analytics/date-ranges";
import { formatCurrencyMinor, formatInteger } from "@/features/analytics/format";
import { getBusinessInsights } from "@/features/analytics/queries";
import type { BusinessInsights } from "@/features/analytics/types";
import type { BookingWithCustomer } from "@/features/bookings/queries";
import { getBookingDashboardStats } from "@/features/bookings/queries";
import { countActiveCustomersForBusiness } from "@/features/customers/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function DashboardMetric({
  href,
  label,
  title,
  value,
  tone = "default",
}: {
  href: Route;
  label: string;
  title: string;
  value: ReactNode;
  tone?: "default" | "attention";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group min-w-0 rounded-lg border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(23,33,29,0.04)] outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-4"
    >
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
      <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
        <p
          className={
            tone === "attention"
              ? "min-w-0 break-words text-2xl font-semibold leading-none text-accent"
              : "min-w-0 break-words text-2xl font-semibold leading-none"
          }
        >
          {value}
        </p>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
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
    <div className="min-w-0 border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(4)]:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs font-medium text-muted-foreground">{bookings.length}</span>
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {bookings.slice(0, 3).map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}` as Route}
              className="group flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-1 hover:text-primary"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{booking.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {booking.customer?.name ?? "Customer unavailable"} ·{" "}
                  {formatDate(booking.scheduled_for)}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function DashboardInsightsSummary({
  insightsPromise,
}: {
  insightsPromise: Promise<BusinessInsights | null>;
}) {
  const monthInsights = await insightsPromise;
  const completedValueSummary = !monthInsights
    ? "Unavailable"
    : monthInsights.value.completed.length === 0
      ? "No completed value"
      : monthInsights.value.completed
          .map((metric) => formatCurrencyMinor(metric.amountMinor, metric.currency))
          .join(" · ");

  return (
    <section className="space-y-3">
      <WorkspaceSectionHeader
        title="This month"
        description="Completed work, recorded value, and customer feedback."
        action={
          <Button asChild variant="ghost" size="sm" className="px-2 text-primary">
            <Link href={"/insights?range=this_month" as Route}>
              View insights
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <Card className="grid grid-cols-3 divide-x divide-border overflow-hidden">
        <Link
          href={"/insights?range=this_month" as Route}
          aria-label="View completed booking insights for this month"
          className="min-w-0 p-3.5 hover:bg-muted/50 sm:p-5"
        >
          <p className="text-[0.6875rem] leading-4 text-muted-foreground sm:text-xs">
            Completed
          </p>
          <p className="mt-1.5 break-words text-lg font-semibold sm:text-xl">
            {monthInsights ? formatInteger(monthInsights.bookings.completed.value) : "--"}
          </p>
        </Link>
        <Link
          href={"/insights?range=this_month" as Route}
          aria-label="View completed booking value insights for this month"
          className="min-w-0 p-3.5 hover:bg-muted/50 sm:p-5"
        >
          <p className="text-[0.6875rem] leading-4 text-muted-foreground sm:text-xs">
            Value
          </p>
          <p className="mt-1.5 break-words text-sm font-semibold leading-5 sm:text-base">
            {completedValueSummary}
          </p>
        </Link>
        <Link
          href={"/insights?range=this_month" as Route}
          aria-label="View feedback insights for this month"
          className="min-w-0 p-3.5 hover:bg-muted/50 sm:p-5"
        >
          <p className="text-[0.6875rem] leading-4 text-muted-foreground sm:text-xs">
            Feedback
          </p>
          <p className="mt-1.5 break-words text-lg font-semibold sm:text-xl">
            {monthInsights ? formatInteger(monthInsights.feedback.responses.value) : "--"}
          </p>
        </Link>
      </Card>
    </section>
  );
}

function DashboardInsightsFallback() {
  return (
    <section className="space-y-3" role="status" aria-label="Loading monthly insights">
      <WorkspaceSectionHeader title="This month" description="Loading monthly activity." />
      <Card className="grid grid-cols-3 divide-x divide-border p-4" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="px-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </Card>
    </section>
  );
}

export default async function DashboardPage() {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) redirect("/onboarding" as Route);

  const monthRange = parseAnalyticsRange({ range: "this_month" });
  const monthInsightsPromise = getBusinessInsights(currentBusiness.id, monthRange).catch(
    () => null,
  );
  const [customerCount, bookingStats] = await Promise.all([
    countActiveCustomersForBusiness(currentBusiness.id),
    getBookingDashboardStats(currentBusiness.id),
  ]);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Welcome back"
        description={
          <>
            Here is what needs attention at{" "}
            <Link
              href={"/business" as Route}
              aria-label="Open business profile"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {currentBusiness.name}
            </Link>
            .
          </>
        }
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

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        aria-label="Business summary"
      >
        <DashboardMetric
          href={"/customers" as Route}
          label="View customer records"
          title="Customers"
          value={customerCount}
        />
        <DashboardMetric
          href={"/bookings?filter=active" as Route}
          label="View active bookings"
          title="Active bookings"
          value={bookingStats.activeBookings}
        />
        <DashboardMetric
          href={"/bookings?filter=today" as Route}
          label="View bookings due today"
          title="Due today"
          value={bookingStats.dueTodayBookings}
        />
        <DashboardMetric
          href={"/bookings?filter=overdue" as Route}
          label="View overdue bookings"
          title="Overdue"
          value={bookingStats.overdueBookings}
          tone={bookingStats.overdueBookings > 0 ? "attention" : "default"}
        />
      </section>

      <section className="space-y-3">
        <WorkspaceSectionHeader
          title="Needs attention"
          description="Bookings that may need action now."
          action={
            <AlertCircle
              className="size-5 text-accent"
              aria-label="Operational attention"
            />
          }
        />
        <Card className="p-4 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:p-5">
          <WorkQueue
            title="Due today"
            bookings={bookingStats.dueToday}
            empty="Nothing due today."
          />
          <WorkQueue
            title="Overdue"
            bookings={bookingStats.overdue}
            empty="No overdue bookings."
          />
          <WorkQueue
            title="In progress"
            bookings={bookingStats.inProgress}
            empty="No work in progress."
          />
          <WorkQueue
            title="Ready"
            bookings={bookingStats.ready}
            empty="Nothing ready for delivery."
          />
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="mt-4 w-full sm:col-span-2"
          >
            <Link href={"/bookings?filter=today" as Route}>
              <CalendarDays className="size-4" aria-hidden="true" />
              View today&apos;s bookings
            </Link>
          </Button>
        </Card>
      </section>

      <Suspense fallback={<DashboardInsightsFallback />}>
        <DashboardInsightsSummary insightsPromise={monthInsightsPromise} />
      </Suspense>
    </WorkspacePage>
  );
}
