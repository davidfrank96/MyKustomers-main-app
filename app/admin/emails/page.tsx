import { AlertTriangle, CheckCircle2, Clock3, Send } from "lucide-react";
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
    <section aria-labelledby="admin-emails-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform Operations</p>
        <h1 id="admin-emails-title" className="mt-2 text-3xl font-semibold">
          Email Operations
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Read-only visibility into booking email outbox events. Sent records represent
          adapter or provider acceptance, not confirmed delivery, opening, or reading.
        </p>
      </header>

      <section
        aria-labelledby="email-delivery-state-title"
        className="border-y border-border py-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Delivery configuration</p>
            <h2 id="email-delivery-state-title" className="mt-1 font-semibold">
              {delivery.label}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {delivery.description}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Transactional provider</p>
              <p className="mt-1 font-semibold">{delivery.provider}</p>
            </div>
            <Badge variant={delivery.status === "incomplete" ? "accent" : "outline"}>
              {formatOperationLabel(delivery.status)}
            </Badge>
          </div>
        </div>
      </section>

      <section aria-labelledby="email-summary-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="email-summary-title" className="text-lg font-semibold">
              Outbox summary
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeLabels[result.summary.range]} ·{" "}
              {result.summary.total.toLocaleString("en")} events
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{health.status}</p>
            <p className="mt-1 text-muted-foreground">{health.description}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {summaryValues.map(([status, value]) => {
            const Icon = statusIcons[status];
            return (
              <Link
                key={status}
                href={buildStatusHref(status, params)}
                data-admin-email-status={status}
                className="bg-card p-4 transition-colors hover:bg-muted/60"
              >
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                  {formatOperationLabel(status)}
                </dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {value.toLocaleString("en")}
                </dd>
                {status === "SENT" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accepted by configured provider
                  </p>
                ) : null}
              </Link>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="email-directory-title" className="space-y-5">
        <div>
          <h2 id="email-directory-title" className="text-lg font-semibold">
            Event directory
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest events first. Search booking reference, business, or event type.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem_15rem_15rem] lg:items-end">
          <DebouncedSearchInput
            clearLabel="Clear email event search"
            initialValue={params.q}
            label="Search email events"
            placeholder="Booking reference, business, or event type"
          />
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
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
            {result.event_types.map((item) => (
              <div key={item.event_type} className="flex items-center gap-2">
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
        ) : null}

        {result.items.length === 0 ? (
          <EmptyState
            title="No email events found."
            description="No outbox records match the current search, date range, and filters."
          />
        ) : (
          <div
            className="divide-y divide-border border-y border-border"
            data-admin-directory="emails"
          >
            {result.items.map((event) => (
              <Link
                key={event.id}
                href={`/admin/emails/${event.id}` as Route}
                className="grid gap-3 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.status === "FAILED" ? "accent" : "outline"}>
                      {formatOperationLabel(event.status)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {formatOperationLabel(event.event_type)}
                    </span>
                  </div>
                  <h3 className="mt-2 break-words font-semibold">
                    {event.booking.reference} · {event.booking.title}
                  </h3>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {event.business.name}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{dateTimeFormatter.format(new Date(event.created_at))} UTC</p>
                  <p className="mt-1">
                    {event.attempt_count.toLocaleString("en")} attempts
                  </p>
                </div>
              </Link>
            ))}
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
