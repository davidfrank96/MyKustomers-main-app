import Link from "next/link";
import type { Route } from "next";
import { BarChart3, CalendarDays, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsDefinitions, analyticsFinancialTerminology } from "@/features/analytics/definitions";
import {
  formatCurrencyMinor,
  formatDecimal,
  formatInteger,
  formatMinutes,
  formatPercent,
} from "@/features/analytics/format";
import type {
  BusinessInsights,
  CountMetric,
  CurrencyMetric,
  PeriodComparison,
  RateMetric,
} from "@/features/analytics/types";
import { issueCategoryLabels } from "@/features/feedback/validation";

function comparisonTone(comparison: PeriodComparison) {
  if (comparison.kind === "increase") {
    return "text-emerald-700";
  }

  if (comparison.kind === "decrease") {
    return "text-amber-700";
  }

  return "text-muted-foreground";
}

function ComparisonText({ comparison }: { comparison: PeriodComparison }) {
  return (
    <p className={`mt-2 text-xs ${comparisonTone(comparison)}`}>
      {comparison.label}
    </p>
  );
}

function MetricCard({
  title,
  value,
  detail,
  comparison,
}: {
  title: string;
  value: string;
  detail: string;
  comparison?: PeriodComparison;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold leading-tight">{value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        {comparison ? <ComparisonText comparison={comparison} /> : null}
      </CardContent>
    </Card>
  );
}

function countValue(metric: CountMetric) {
  return formatInteger(metric.value);
}

function rateValue(metric: RateMetric) {
  return formatPercent(metric.value);
}

function CurrencyMetricList({
  title,
  empty,
  metrics,
}: {
  title: string;
  empty: string;
  metrics: CurrencyMetric[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {metrics.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-3">
            {metrics.map((metric) => (
              <div
                key={`${title}-${metric.currency}`}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{metric.currency}</p>
                  <p className="text-sm font-semibold">
                    {formatCurrencyMinor(metric.amountMinor, metric.currency)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatInteger(metric.bookingCount)} booking{metric.bookingCount === 1 ? "" : "s"}
                </p>
                <ComparisonText comparison={metric.comparison} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RangeForm({ insights }: { insights: BusinessInsights }) {
  return (
    <form className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="space-y-1 text-sm">
        <span className="font-medium">Range</span>
        <select
          name="range"
          defaultValue={insights.range.preset}
          className="min-h-11 w-full rounded-md border border-border bg-card px-3 py-2"
        >
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="this_year">This year</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">From</span>
        <input
          type="date"
          name="from"
          defaultValue={insights.range.fromInput}
          className="min-h-11 w-full rounded-md border border-border bg-card px-3 py-2"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">To</span>
        <input
          type="date"
          name="to"
          defaultValue={insights.range.toInput}
          className="min-h-11 w-full rounded-md border border-border bg-card px-3 py-2"
        />
      </label>
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          Apply
        </Button>
      </div>
    </form>
  );
}

function SectionHeader({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold leading-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function IssueDistribution({ insights }: { insights: BusinessInsights }) {
  const max = Math.max(...insights.issues.categories.map((item) => item.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue categories</CardTitle>
      </CardHeader>
      <CardContent>
        {insights.issues.categories.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            No issues recorded in this period.
          </p>
        ) : (
          <div className="space-y-3" aria-label="Issue category distribution">
            {insights.issues.categories.map((item) => {
              const width = max > 0 ? `${Math.max(8, (item.count / max) * 100)}%` : "0%";

              return (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span>{issueCategoryLabels[item.category]}</span>
                    <span className="font-medium">{formatInteger(item.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-2 rounded-full bg-foreground" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingTrend({ insights }: { insights: BusinessInsights }) {
  const points = insights.current.trends.bookings.slice(-8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking trend</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            No bookings created in this period.
          </p>
        ) : (
          <div className="space-y-2">
            {points.map((point) => (
              <div
                key={point.periodStart}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: insights.current.range.bucket === "day" ? "numeric" : undefined,
                    year: "numeric",
                  }).format(new Date(point.periodStart))}
                </span>
                <span className="text-muted-foreground">
                  {formatInteger(point.created)} created · {formatInteger(point.completed)} completed
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DefinitionsList() {
  return (
    <details className="rounded-md border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Metric definitions</summary>
      <div className="mt-4 space-y-3">
        <p className="leading-6 text-muted-foreground">{analyticsFinancialTerminology}</p>
        <dl className="grid gap-3 md:grid-cols-2">
          {analyticsDefinitions.map((definition) => (
            <div key={definition.metric} className="rounded-md border border-border p-3">
              <dt className="font-medium">{definition.metric}</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">{definition.formula}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

export function InsightsView({ insights }: { insights: BusinessInsights }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="outline">
              <BarChart3 className="size-3" aria-hidden="true" />
              Private business insights
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
              Insights
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Metrics are calculated from stored customer, booking, feedback, and issue records for the current business only.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={"/dashboard" as Route}>
              Dashboard
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <RangeForm insights={insights} />
        {insights.range.error ? (
          <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {insights.range.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <CalendarDays className="size-3" aria-hidden="true" />
            {insights.range.label}
          </Badge>
          <Badge variant="outline">
            Previous period: {insights.range.previousFrom.toISOString().slice(0, 10)} to{" "}
            {new Date(insights.range.previousTo.getTime() - 1).toISOString().slice(0, 10)}
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active customers"
          value={formatInteger(insights.customers.totalActive)}
          detail="Current non-archived customer records."
        />
        <MetricCard
          title="Bookings created"
          value={countValue(insights.bookings.created)}
          detail="All booking records created in the period."
          comparison={insights.bookings.created.comparison}
        />
        <MetricCard
          title="Completed bookings"
          value={countValue(insights.bookings.completed)}
          detail="Completed by completion date."
          comparison={insights.bookings.completed.comparison}
        />
        <MetricCard
          title="Feedback responses"
          value={countValue(insights.feedback.responses)}
          detail="Private feedback submitted in the period."
          comparison={insights.feedback.responses.comparison}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Customer activity"
          detail="Customer metrics use saved customer records and qualifying booking history."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="New customers"
            value={countValue(insights.customers.new)}
            detail="First qualifying booking in this period."
            comparison={insights.customers.new.comparison}
          />
          <MetricCard
            title="Returning customers"
            value={countValue(insights.customers.returning)}
            detail="Period customers with at least two lifetime qualifying bookings."
            comparison={insights.customers.returning.comparison}
          />
          <MetricCard
            title="Repeat customer rate"
            value={rateValue(insights.customers.repeatRate)}
            detail={`${formatInteger(insights.customers.repeatRate.numerator)} of ${formatInteger(insights.customers.repeatRate.denominator)} qualifying period customers.`}
            comparison={insights.customers.repeatRate.comparison}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Bookings and value"
          detail="Values are recorded booking values, not revenue or cash received. Currencies are never combined."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Cancelled bookings"
            value={countValue(insights.bookings.cancelled)}
            detail="Cancelled by cancellation date."
            comparison={insights.bookings.cancelled.comparison}
          />
          <MetricCard
            title="Active bookings"
            value={formatInteger(insights.bookings.active)}
            detail="Current non-terminal bookings."
          />
          <CurrencyMetricList
            title="Recorded booking value"
            empty="No recorded booking value in this period."
            metrics={insights.value.recorded}
          />
          <CurrencyMetricList
            title="Completed booking value"
            empty="No completed bookings in this period."
            metrics={insights.value.completed}
          />
          <CurrencyMetricList
            title="Average booking value"
            empty="No average value available in this period."
            metrics={insights.value.average}
          />
          <CurrencyMetricList
            title="Recorded deposits"
            empty="No recorded deposits in this period."
            metrics={insights.value.deposits}
          />
          <BookingTrend insights={insights} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Operations"
          detail="Operational metrics use actual lifecycle timestamps and the current agreed schedule."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="On-time rate"
            value={rateValue(insights.operations.onTimeRate)}
            detail={`${formatInteger(insights.operations.onTimeRate.numerator)} of ${formatInteger(insights.operations.onTimeRate.denominator)} eligible completed bookings.`}
            comparison={insights.operations.onTimeRate.comparison}
          />
          <MetricCard
            title="Overdue bookings"
            value={formatInteger(insights.operations.overdue)}
            detail="Current scheduled open bookings past due."
          />
          <MetricCard
            title="Cancellation rate"
            value={rateValue(insights.operations.cancellationRate)}
            detail={`${formatInteger(insights.operations.cancellationRate.numerator)} of ${formatInteger(insights.operations.cancellationRate.denominator)} finalized bookings.`}
            comparison={insights.operations.cancellationRate.comparison}
          />
          <MetricCard
            title="Avg fulfilment duration"
            value={formatMinutes(insights.current.operations.averageFulfillmentMinutes)}
            detail="Start work to completion."
            comparison={insights.operations.averageFulfillmentMinutes.comparison}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Feedback"
          detail="Feedback metrics use submitted private feedback only; comments are not analyzed."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Average rating"
            value={formatDecimal(insights.current.feedback.averageRating, 1)}
            detail="Average private overall rating."
            comparison={insights.feedback.averageRating.comparison}
          />
          <MetricCard
            title="Feedback says on time"
            value={rateValue(insights.feedback.onTimePercentage)}
            detail={`${formatInteger(insights.feedback.onTimePercentage.numerator)} of ${formatInteger(insights.feedback.onTimePercentage.denominator)} responses.`}
            comparison={insights.feedback.onTimePercentage.comparison}
          />
          <MetricCard
            title="Met expectations"
            value={rateValue(insights.feedback.metExpectationsPercentage)}
            detail={`${formatInteger(insights.feedback.metExpectationsPercentage.numerator)} of ${formatInteger(insights.feedback.metExpectationsPercentage.denominator)} responses.`}
            comparison={insights.feedback.metExpectationsPercentage.comparison}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Issues"
          detail="Issue metrics count internal operational issue records. They are not causal analysis."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Issues opened"
            value={countValue(insights.issues.opened)}
            detail="Created in this period."
            comparison={insights.issues.opened.comparison}
          />
          <MetricCard
            title="Issues resolved"
            value={countValue(insights.issues.resolved)}
            detail="Resolved in this period."
            comparison={insights.issues.resolved.comparison}
          />
          <MetricCard
            title="Issue resolution rate"
            value={rateValue(insights.issues.resolutionRate)}
            detail={`${formatInteger(insights.issues.resolutionRate.numerator)} of ${formatInteger(insights.issues.resolutionRate.denominator)} opened issues resolved.`}
            comparison={insights.issues.resolutionRate.comparison}
          />
          <IssueDistribution insights={insights} />
        </div>
      </section>

      <DefinitionsList />
    </main>
  );
}
