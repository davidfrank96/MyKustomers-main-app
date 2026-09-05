import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  Send,
  Server,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { AdminFilterSelect } from "@/components/admin/admin-filter-select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  adminEmailEventTypes,
  adminEmailRanges,
  adminEmailStatuses,
  getAdminEmailHealth,
  parseAdminEmailParams,
} from "@/features/admin/email-operations";
import { formatOperationLabel } from "@/features/admin/operations";
import {
  getAdminEmailDeliveryConfiguration,
  listAdminEmailOperations,
} from "@/features/admin/queries";
import { presentProviderDelivery } from "@/features/provider-delivery/model";

export const metadata: Metadata = {
  title: "Email operations | Platform administration",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const statusIcons = {
  PENDING: Clock3,
  SENDING: Send,
  SENT: CheckCircle2,
  FAILED: AlertTriangle,
} as const;

const rangeLabels = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };

const statusStyles = {
  PENDING: "border-blue-200 bg-blue-50 text-blue-900",
  SENDING: "border-amber-200 bg-amber-50 text-amber-900",
  SENT: "border-primary/20 bg-primary/5 text-primary",
  FAILED: "border-destructive/20 bg-destructive/5 text-destructive",
} as const;
const metricDescriptions = {
  PENDING: "Waiting to be processed",
  SENDING: "Currently being attempted",
  SENT: "Outbox acceptance, including development adapters",
  FAILED: "Events in the failed state",
} as const;

function buildStatusHref(
  status: string,
  params: ReturnType<typeof parseAdminEmailParams>,
) {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (params.q) query.set("q", params.q);
  if (params.eventType !== "all") query.set("eventType", params.eventType);
  if (params.range !== "7d") query.set("range", params.range);
  if (params.businessId) query.set("business", params.businessId);
  if (params.bookingId) query.set("booking", params.bookingId);
  const value = query.toString();
  return (value ? `/admin/emails?${value}` : "/admin/emails") as Route;
}

export default async function AdminEmailsPage({ searchParams }: PageProps) {
  const params = parseAdminEmailParams((await searchParams) ?? {});
  const [result, delivery] = await Promise.all([
    listAdminEmailOperations(params),
    Promise.resolve(getAdminEmailDeliveryConfiguration()),
  ]);
  const health = getAdminEmailHealth(result.summary);
  const summaryValues = [
    ["PENDING", result.summary.pending],
    ["SENDING", result.summary.sending],
    ["SENT", result.summary.sent],
    ["FAILED", result.summary.failed],
  ] as const;

  return (
    <section aria-labelledby="admin-emails-title" className="min-w-0 space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase leading-5 text-primary">
          Platform Operations
        </p>
        <h1
          id="admin-emails-title"
          className="mt-1 text-[28px] font-semibold leading-tight sm:text-[32px]"
        >
          Email Operations
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Read-only visibility into booking email outbox events. Sent records represent
          adapter or provider acceptance, not confirmed delivery, opening, or reading.
        </p>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="email-delivery-state-title"
          className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 sm:gap-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary sm:size-12">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h2
              id="email-delivery-state-title"
              className="text-xs font-medium text-muted-foreground"
            >
              Delivery configuration
            </h2>
            <p className="mt-2 text-sm font-semibold">{delivery.label}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {delivery.description}
            </p>
          </div>
        </section>
        <section
          aria-labelledby="email-provider-title"
          className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 sm:gap-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary sm:size-12">
            <Server className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h2
              id="email-provider-title"
              className="text-xs font-medium text-muted-foreground"
            >
              Transactional provider
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm font-semibold">{delivery.provider}</p>
              <Badge
                className="w-fit shrink-0 rounded"
                variant={delivery.status === "incomplete" ? "accent" : "outline"}
              >
                {formatOperationLabel(delivery.status)}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Provider acceptance and recipient delivery are reported separately.
            </p>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="email-summary-title"
        className="min-w-0 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="email-summary-title" className="text-base font-semibold">
              Outbox summary
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeLabels[result.summary.range]} ·{" "}
              {result.summary.total.toLocaleString("en")} events
            </p>
          </div>
          <div className="min-w-0 text-xs sm:text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium ${health.status === "Healthy" ? statusStyles.SENT : statusStyles.SENDING}`}
            >
              {health.status === "Healthy" ? (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-3.5" aria-hidden="true" />
              )}
              Outbox: {health.status}
            </span>
            <p className="mt-1 leading-5 text-muted-foreground">{health.description}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 rounded-md border border-border [&>div]:border-border [&>div:nth-child(odd)]:border-r [&>div:nth-child(-n+2)]:border-b xl:grid-cols-4 xl:[&>div:nth-child(-n+2)]:border-b-0 xl:[&>div:not(:last-child)]:border-r">
          {summaryValues.map(([status, value]) => {
            const Icon = statusIcons[status];
            return (
              <div key={status} className="min-w-0">
                <Link
                  href={buildStatusHref(status, params)}
                  data-admin-email-status={status}
                  className="flex h-full min-w-0 flex-col items-start gap-3 p-3 transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[430px]:flex-row sm:p-4"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${status === "FAILED" && value === 0 ? "bg-muted text-muted-foreground" : statusStyles[status]}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <dl className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {formatOperationLabel(status)}
                    </dt>
                    <dd
                      className={`mt-1 break-words text-2xl font-semibold tabular-nums ${status === "FAILED" && value > 0 ? "text-destructive" : ""}`}
                    >
                      {value.toLocaleString("en")}
                    </dd>
                    <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                      {metricDescriptions[status]}
                    </dd>
                  </dl>
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          These are outbox operation counts, not externally sent or delivered totals.
          Provider callbacks below supply separate recipient-delivery evidence.
        </p>
      </section>

      {result.provider_delivery_totals ? (
        <section
          aria-labelledby="provider-delivery-summary-title"
          className="min-w-0 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="provider-delivery-summary-title"
                className="text-base font-semibold"
              >
                Provider delivery
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Brevo recipient outcomes; outbox infrastructure remains a separate signal.
              </p>
            </div>
            <Badge
              variant={
                result.provider_delivery_totals.brevo_outcomes.soft_bounced +
                  result.provider_delivery_totals.brevo_outcomes.hard_bounced +
                  result.provider_delivery_totals.brevo_outcomes.invalid +
                  result.provider_delivery_totals.brevo_outcomes.blocked +
                  result.provider_delivery_totals.brevo_outcomes.complaint +
                  result.provider_delivery_totals.brevo_outcomes.provider_error >
                0
                  ? "accent"
                  : "outline"
              }
            >
              Recipient delivery:{" "}
              {result.provider_delivery_totals.brevo_outcomes.soft_bounced +
                result.provider_delivery_totals.brevo_outcomes.hard_bounced +
                result.provider_delivery_totals.brevo_outcomes.invalid +
                result.provider_delivery_totals.brevo_outcomes.blocked +
                result.provider_delivery_totals.brevo_outcomes.complaint +
                result.provider_delivery_totals.brevo_outcomes.provider_error >
              0
                ? "Attention"
                : "No current failures"}
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {[
              ["Accepted externally", result.provider_delivery_totals.external_accepted],
              [
                "Provider delivered",
                result.provider_delivery_totals.brevo_outcomes.delivered,
              ],
              ["Delayed", result.provider_delivery_totals.brevo_outcomes.deferred],
              [
                "Delivery attention",
                result.provider_delivery_totals.brevo_outcomes.soft_bounced +
                  result.provider_delivery_totals.brevo_outcomes.hard_bounced +
                  result.provider_delivery_totals.brevo_outcomes.invalid +
                  result.provider_delivery_totals.brevo_outcomes.blocked +
                  result.provider_delivery_totals.brevo_outcomes.complaint +
                  result.provider_delivery_totals.brevo_outcomes.provider_error,
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 bg-card p-3 sm:p-4">
                <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {result.provider_delivery_totals.development_operations} development-adapter
            operations and {result.provider_delivery_totals.brevo_outcomes.unknown} Brevo
            operations without a callback are shown truthfully; no historical events were
            fabricated.
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="email-directory-title"
        className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div>
          <h2 id="email-directory-title" className="text-base font-semibold">
            Event directory
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest events first. Search booking reference, business, or event type.
          </p>
        </div>
        <div
          data-email-filters
          className="grid min-w-0 gap-3 md:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] xl:items-end [&>div]:w-full"
        >
          <div className="min-w-0 md:col-span-3 xl:col-span-1">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Search email events
            </span>
            <DebouncedSearchInput
              clearLabel="Clear email event search"
              initialValue={params.q}
              label="Search email events"
              placeholder="Booking reference, business, or event type"
            />
          </div>
          <AdminFilterSelect
            label="Event status"
            param="status"
            value={params.status}
            options={adminEmailStatuses.map((value) => ({
              value,
              label: formatOperationLabel(value),
            }))}
          />
          <AdminFilterSelect
            label="Event type"
            param="eventType"
            value={params.eventType}
            options={adminEmailEventTypes.map((value) => ({
              value,
              label: formatOperationLabel(value),
            }))}
          />
          <AdminFilterSelect
            label="Date range"
            param="range"
            value={params.range}
            options={adminEmailRanges.map((value) => ({
              value,
              label: rangeLabels[value],
            }))}
          />
        </div>

        {params.businessId || params.bookingId ? (
          <p className="text-sm text-muted-foreground">
            Filtered to {params.bookingId ? "one booking" : "one business"}.{" "}
            <Link href="/admin/emails" className="font-medium text-primary">
              Clear context filter
            </Link>
          </p>
        ) : null}

        {result.event_types.length > 0 ? (
          <div
            role="region"
            aria-label="Event type totals"
            tabIndex={0}
            className="overflow-x-auto border-y border-border py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [overscroll-behavior-inline:contain]"
          >
            <dl className="flex w-max min-w-full gap-5 text-xs sm:w-auto sm:flex-wrap">
              {result.event_types.map((item) => (
                <div key={item.event_type} className="flex shrink-0 items-center gap-2">
                  <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">
                    {formatOperationLabel(item.event_type)}
                  </dt>
                  <dd className="font-semibold tabular-nums">{item.count}</dd>
                  {item.failed > 0 ? (
                    <span className="text-destructive">{item.failed} failed</span>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {result.items.length === 0 ? (
          <EmptyState
            title="No email events found."
            description="No outbox records match the current search, date range, and filters."
          />
        ) : (
          <div
            role="region"
            aria-label="Email outbox events"
            tabIndex={0}
            className="min-w-0 rounded-md border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:max-h-[clamp(32rem,56vh,48rem)] md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable]"
            data-admin-directory="emails"
          >
            <ul className="divide-y divide-border">
              {result.items.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/emails/${event.id}` as Route}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:grid-cols-[5rem_minmax(0,1fr)_13rem_auto] md:items-center"
                  >
                    <Badge
                      className={`col-start-1 w-fit rounded px-2 py-0.5 text-xs ${statusStyles[event.status]}`}
                      variant="outline"
                    >
                      {formatOperationLabel(event.status)}
                    </Badge>
                    <div className="col-start-1 min-w-0 [overflow-wrap:anywhere] md:col-start-2 md:row-start-1">
                      <p className="text-sm font-medium">
                        {formatOperationLabel(event.event_type)}
                      </p>
                      {event.development_adapter ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Development adapter — no external email sent
                        </p>
                      ) : null}
                      {event.provider_delivery && !event.development_adapter ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {presentProviderDelivery(event.provider_delivery).title}
                        </p>
                      ) : null}
                      <h3 className="mt-0.5 text-sm font-semibold">
                        {event.booking.reference} · {event.booking.title}
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {event.business.name}
                      </p>
                    </div>
                    <div className="col-start-1 min-w-0 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere] md:col-start-3 md:row-start-1 md:text-right">
                      <time dateTime={event.created_at}>
                        {dateTimeFormatter.format(new Date(event.created_at))} UTC
                      </time>
                      <p>
                        {event.attempt_count.toLocaleString("en")}{" "}
                        {event.attempt_count === 1 ? "attempt" : "attempts"}
                      </p>
                    </div>
                    <ChevronRight
                      className="col-start-2 row-span-3 row-start-1 size-4 self-center text-muted-foreground md:col-start-4 md:row-span-1"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AdminPagination
          basePath="/admin/emails"
          page={result.page}
          q={params.q}
          total={result.total}
          totalPages={result.totalPages}
          preservedParams={{
            status: params.status === "all" ? undefined : params.status,
            eventType: params.eventType === "all" ? undefined : params.eventType,
            range: params.range === "7d" ? undefined : params.range,
            business: params.businessId,
            booking: params.bookingId,
          }}
        />
      </section>
    </section>
  );
}
