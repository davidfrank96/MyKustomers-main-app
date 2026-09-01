import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Ban,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleCheckBig,
  Clock3,
  FileWarning,
  MessageSquareText,
  Percent,
  Repeat2,
  Star,
  ThumbsUp,
  Timer,
  TriangleAlert,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InsightsRangeSelector } from "@/features/analytics/components/insights-range-selector";
import {
  analyticsDefinitions,
  analyticsFinancialTerminology,
} from "@/features/analytics/definitions";
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
import { cn } from "@/lib/utils/cn";

function comparisonTone(comparison: PeriodComparison) {
  if (comparison.kind === "new" || comparison.kind === "increase") {
    return "text-primary";
  }

  if (comparison.kind === "decrease") {
    return "text-amber-700";
  }

  return "text-muted-foreground";
}

function ComparisonText({ comparison }: { comparison: PeriodComparison }) {
  return (
    <p
      className={cn(
        "mt-1.5 text-[0.6875rem] font-medium leading-4 sm:text-xs",
        comparisonTone(comparison),
      )}
    >
      {comparison.label}
    </p>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  comparison?: PeriodComparison;
  className?: string;
  valueClassName?: string;
};

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  comparison,
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card className={cn("h-full", className)} data-insights-metric={title}>
      <CardContent className="relative h-full p-3.5 sm:p-4">
        <div className="pr-10">
          <h3 className="text-xs font-semibold leading-4 text-foreground sm:text-sm">
            {title}
          </h3>
          <p
            className={cn(
              "mt-1.5 break-words text-2xl font-semibold leading-none sm:text-[1.75rem]",
              valueClassName,
            )}
          >
            {value}
          </p>
        </div>
        <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-muted text-primary sm:size-10">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <p className="mt-1.5 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">
          {detail}
        </p>
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

function CurrencyMetricCard({
  title,
  empty,
  metrics,
  icon: Icon,
}: {
  title: string;
  empty: string;
  metrics: CurrencyMetric[];
  icon: LucideIcon;
}) {
  return (
    <Card className="h-full" data-insights-metric={title}>
      <CardContent className="relative h-full p-3.5 sm:p-4">
        <h3 className="pr-10 text-xs font-semibold leading-4 sm:text-sm">{title}</h3>
        <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-muted text-primary sm:size-10">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        {metrics.length === 0 ? (
          <p className="mt-4 text-sm leading-5 text-muted-foreground">{empty}</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {metrics.map((metric) => (
              <div
                key={`${title}-${metric.currency}`}
                className="py-2 first:pt-0 last:pb-0"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {metric.currency}
                </p>
                <p className="mt-1 break-words text-xl font-semibold leading-tight [overflow-wrap:anywhere] min-[390px]:text-2xl">
                  {formatCurrencyMinor(metric.amountMinor, metric.currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatInteger(metric.bookingCount)} booking
                  {metric.bookingCount === 1 ? "" : "s"}
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

function InsightsScroller({
  label,
  marker,
  children,
  gridClassName,
}: {
  label: string;
  marker: string;
  children: ReactNode;
  gridClassName: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      data-insights-scroller={marker}
      className={cn(
        "flex w-full max-w-full snap-x snap-proximity gap-3 overflow-x-auto pb-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>*]:w-[82%] [&>*]:shrink-0 [&>*]:snap-start [&::-webkit-scrollbar]:hidden sm:grid sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto",
        gridClassName,
      )}
    >
      {children}
    </div>
  );
}

function InsightsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = `insights-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section className="min-w-0 space-y-2.5" aria-labelledby={id}>
      <h2 id={id} className="text-base font-semibold leading-6 sm:text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function IssueDistribution({ insights }: { insights: BusinessInsights }) {
  const max = Math.max(...insights.issues.categories.map((item) => item.count), 0);

  return (
    <Card>
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Issue categories</h3>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-primary">
            <FileWarning className="size-4.5" aria-hidden="true" />
          </span>
        </div>
        {insights.issues.categories.length === 0 ? (
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            No issues recorded in this period.
          </p>
        ) : (
          <div className="mt-3 space-y-3" aria-label="Issue category distribution">
            {insights.issues.categories.map((item) => {
              const width = max > 0 ? `${Math.max(8, (item.count / max) * 100)}%` : "0%";

              return (
                <div key={item.category}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span>{issueCategoryLabels[item.category]}</span>
                    <span className="font-semibold">{formatInteger(item.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-2 rounded-full bg-primary" style={{ width }} />
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

function formatTrendDate(periodStart: string, bucket: "day" | "month") {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: bucket === "day" ? "numeric" : undefined,
  }).format(new Date(periodStart));
}

function BookingTrend({ insights }: { insights: BusinessInsights }) {
  const points = insights.current.trends.bookings;
  const max = Math.max(...points.flatMap((point) => [point.created, point.completed]), 1);
  const chartWidth = Math.max(320, points.length * 64);

  return (
    <Card data-booking-trend>
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Booking trend</h3>
          <div className="flex gap-3 text-xs text-muted-foreground" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 bg-primary" /> Created
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 bg-[#a8cdbb]" /> Completed
            </span>
          </div>
        </div>
        {points.length === 0 ? (
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            No bookings created in this period.
          </p>
        ) : (
          <>
            <ul className="sr-only" aria-label="Booking trend values">
              {points.map((point) => (
                <li key={point.periodStart}>
                  {formatTrendDate(point.periodStart, insights.current.range.bucket)}:{" "}
                  {point.created} bookings created, {point.completed} completed
                </li>
              ))}
            </ul>
            <div
              className="mt-4 max-w-full overflow-x-auto pb-1 [scrollbar-width:thin]"
              data-booking-trend-viewport
            >
              <div style={{ width: chartWidth }} aria-hidden="true">
                <div className="relative h-40 border-b border-l border-border">
                  <span className="absolute -left-0.5 top-0 -translate-x-full pr-2 text-[0.625rem] text-muted-foreground">
                    {max}
                  </span>
                  <span className="absolute -bottom-1.5 -left-0.5 -translate-x-full pr-2 text-[0.625rem] text-muted-foreground">
                    0
                  </span>
                  <div
                    className="grid h-full items-end gap-2 px-3"
                    style={{
                      gridTemplateColumns: `repeat(${points.length}, minmax(44px, 1fr))`,
                    }}
                  >
                    {points.map((point) => (
                      <div
                        key={point.periodStart}
                        className="flex h-full items-end justify-center gap-1"
                      >
                        <span
                          className="w-3.5 bg-primary"
                          style={{
                            height:
                              point.created > 0
                                ? `${Math.max(5, (point.created / max) * 100)}%`
                                : 0,
                          }}
                        />
                        <span
                          className="w-3.5 bg-[#a8cdbb]"
                          style={{
                            height:
                              point.completed > 0
                                ? `${Math.max(5, (point.completed / max) * 100)}%`
                                : 0,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="mt-2 grid gap-2 px-3 text-center text-[0.625rem] text-muted-foreground sm:text-xs"
                  style={{
                    gridTemplateColumns: `repeat(${points.length}, minmax(44px, 1fr))`,
                  }}
                >
                  {points.map((point) => (
                    <span key={point.periodStart}>
                      {formatTrendDate(point.periodStart, insights.current.range.bucket)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DefinitionsList() {
  return (
    <details className="rounded-lg border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Metric definitions
      </summary>
      <div className="mt-4 space-y-3">
        <p className="leading-6 text-muted-foreground">{analyticsFinancialTerminology}</p>
        <dl className="grid gap-3 md:grid-cols-2">
          {analyticsDefinitions.map((definition) => (
            <div key={definition.metric} className="rounded-md border border-border p-3">
              <dt className="font-medium">{definition.metric}</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">
                {definition.formula}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

function previousPeriodLabel(insights: BusinessInsights) {
  const from = insights.range.previousFrom;
  const to = new Date(insights.range.previousTo.getTime() - 1);
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const first = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(from);
  const last = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(to);

  return `Previous period: ${first} – ${last}`;
}

export function InsightsView({ insights }: { insights: BusinessInsights }) {
  return (
    <WorkspacePage className="min-w-0 pb-28 lg:pb-7">
      <section className="min-w-0 space-y-3">
        <WorkspacePageHeader
          title="Insights"
          description="Private metrics calculated from saved business records."
        />
        <InsightsRangeSelector
          activePreset={insights.range.preset}
          fromInput={insights.range.fromInput}
          toInput={insights.range.toInput}
        />
        {insights.range.error ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {insights.range.error}
          </p>
        ) : null}
        <Badge variant="outline" className="max-w-full whitespace-normal text-left">
          <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
          {previousPeriodLabel(insights)}
        </Badge>
      </section>

      <InsightsSection title="Business overview">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="Active customers"
            value={formatInteger(insights.customers.totalActive)}
            detail="Current non-archived customers."
            icon={Users}
          />
          <MetricCard
            title="Bookings created"
            value={countValue(insights.bookings.created)}
            detail="All booking records created."
            comparison={insights.bookings.created.comparison}
            icon={CalendarDays}
          />
          <MetricCard
            title="Completed bookings"
            value={countValue(insights.bookings.completed)}
            detail="Completed by completion date."
            comparison={insights.bookings.completed.comparison}
            icon={CircleCheckBig}
          />
          <MetricCard
            title="Feedback responses"
            value={countValue(insights.feedback.responses)}
            detail="Private feedback submitted."
            comparison={insights.feedback.responses.comparison}
            icon={MessageSquareText}
          />
        </div>
      </InsightsSection>

      <InsightsSection title="Customer activity">
        <InsightsScroller
          label="Customer activity metrics"
          marker="customer-activity"
          gridClassName="sm:grid-cols-3"
        >
          <MetricCard
            title="New customers"
            value={countValue(insights.customers.new)}
            detail="First qualifying booking in this period."
            comparison={insights.customers.new.comparison}
            icon={UserPlus}
          />
          <MetricCard
            title="Returning customers"
            value={countValue(insights.customers.returning)}
            detail="Customers with qualifying repeat booking history."
            comparison={insights.customers.returning.comparison}
            icon={Repeat2}
          />
          <MetricCard
            title="Repeat customer rate"
            value={rateValue(insights.customers.repeatRate)}
            detail={`${formatInteger(insights.customers.repeatRate.numerator)} of ${formatInteger(insights.customers.repeatRate.denominator)} qualifying period customers.`}
            comparison={insights.customers.repeatRate.comparison}
            icon={Percent}
          />
        </InsightsScroller>
      </InsightsSection>

      <InsightsSection title="Bookings & value">
        <InsightsScroller
          label="Booking and value metrics"
          marker="bookings-value"
          gridClassName="sm:grid-cols-2 lg:grid-cols-4"
        >
          <CurrencyMetricCard
            title="Recorded booking value"
            empty="No recorded booking value in this period."
            metrics={insights.value.recorded}
            icon={Banknote}
          />
          <CurrencyMetricCard
            title="Completed booking value"
            empty="No completed bookings in this period."
            metrics={insights.value.completed}
            icon={CircleCheckBig}
          />
          <CurrencyMetricCard
            title="Average booking value"
            empty="No average value available in this period."
            metrics={insights.value.average}
            icon={ChartNoAxesColumnIncreasing}
          />
          <CurrencyMetricCard
            title="Recorded deposits"
            empty="No recorded deposits in this period."
            metrics={insights.value.deposits}
            icon={WalletCards}
          />
          <MetricCard
            title="Active bookings"
            value={formatInteger(insights.bookings.active)}
            detail="Current non-terminal bookings."
            icon={CalendarClock}
          />
          <MetricCard
            title="Cancelled bookings"
            value={countValue(insights.bookings.cancelled)}
            detail="Cancelled by cancellation date."
            comparison={insights.bookings.cancelled.comparison}
            icon={Ban}
          />
        </InsightsScroller>
        <BookingTrend insights={insights} />
      </InsightsSection>

      <InsightsSection title="Operations">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="On-time rate"
            value={rateValue(insights.operations.onTimeRate)}
            detail={`${formatInteger(insights.operations.onTimeRate.numerator)} of ${formatInteger(insights.operations.onTimeRate.denominator)} eligible completed bookings.`}
            comparison={insights.operations.onTimeRate.comparison}
            icon={Clock3}
          />
          <MetricCard
            title="Overdue bookings"
            value={formatInteger(insights.operations.overdue)}
            detail="Current scheduled open bookings past due."
            icon={TriangleAlert}
          />
          <MetricCard
            title="Cancellation rate"
            value={rateValue(insights.operations.cancellationRate)}
            detail={`${formatInteger(insights.operations.cancellationRate.numerator)} of ${formatInteger(insights.operations.cancellationRate.denominator)} finalized bookings.`}
            comparison={insights.operations.cancellationRate.comparison}
            icon={Ban}
          />
          <MetricCard
            title="Avg fulfilment duration"
            value={formatMinutes(insights.current.operations.averageFulfillmentMinutes)}
            detail="Start work to completion."
            comparison={insights.operations.averageFulfillmentMinutes.comparison}
            icon={Timer}
            valueClassName="text-xl min-[390px]:text-2xl"
          />
        </div>
      </InsightsSection>

      <InsightsSection title="Feedback">
        <InsightsScroller
          label="Feedback metrics"
          marker="feedback"
          gridClassName="sm:grid-cols-3"
        >
          <MetricCard
            title="Average rating"
            value={formatDecimal(insights.current.feedback.averageRating, 1)}
            detail="Average private overall rating."
            comparison={insights.feedback.averageRating.comparison}
            icon={Star}
          />
          <MetricCard
            title="Feedback says on time"
            value={rateValue(insights.feedback.onTimePercentage)}
            detail={`${formatInteger(insights.feedback.onTimePercentage.numerator)} of ${formatInteger(insights.feedback.onTimePercentage.denominator)} responses.`}
            comparison={insights.feedback.onTimePercentage.comparison}
            icon={CalendarCheck2}
          />
          <MetricCard
            title="Met expectations"
            value={rateValue(insights.feedback.metExpectationsPercentage)}
            detail={`${formatInteger(insights.feedback.metExpectationsPercentage.numerator)} of ${formatInteger(insights.feedback.metExpectationsPercentage.denominator)} responses.`}
            comparison={insights.feedback.metExpectationsPercentage.comparison}
            icon={ThumbsUp}
          />
        </InsightsScroller>
      </InsightsSection>

      <InsightsSection title="Issues">
        <InsightsScroller
          label="Issue summary metrics"
          marker="issues"
          gridClassName="sm:grid-cols-3"
        >
          <MetricCard
            title="Issues opened"
            value={countValue(insights.issues.opened)}
            detail="Created in this period."
            comparison={insights.issues.opened.comparison}
            icon={FileWarning}
          />
          <MetricCard
            title="Issues resolved"
            value={countValue(insights.issues.resolved)}
            detail="Resolved in this period."
            comparison={insights.issues.resolved.comparison}
            icon={CircleCheckBig}
          />
          <MetricCard
            title="Issue resolution rate"
            value={rateValue(insights.issues.resolutionRate)}
            detail={`${formatInteger(insights.issues.resolutionRate.numerator)} of ${formatInteger(insights.issues.resolutionRate.denominator)} opened issues resolved.`}
            comparison={insights.issues.resolutionRate.comparison}
            icon={ChartNoAxesColumnIncreasing}
          />
        </InsightsScroller>
        <IssueDistribution insights={insights} />
      </InsightsSection>

      <DefinitionsList />
    </WorkspacePage>
  );
}
