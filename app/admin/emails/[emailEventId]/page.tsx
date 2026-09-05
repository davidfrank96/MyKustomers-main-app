import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  RotateCw,
  ShieldAlert,
  Activity,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { PrivilegedActionDialog } from "@/components/admin/privileged-action-dialog";
import { retryFailedEmailAction } from "@/features/admin/email-retry-actions";
import { formatEmailFailureCategory } from "@/features/admin/email-operations";
import { formatOperationLabel } from "@/features/admin/operations";
import { getAdminEmailEvent } from "@/features/admin/queries";
import { presentProviderDelivery } from "@/features/provider-delivery/model";

export const metadata: Metadata = {
  title: "Email event | Platform administration",
};

type PageProps = { params: Promise<{ emailEventId: string }> };
const uuidSchema = z.string().uuid();
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  return value ? `${dateTimeFormatter.format(new Date(value))} UTC` : "Not recorded";
}

export default async function AdminEmailEventPage({ params }: PageProps) {
  const parsedId = uuidSchema.safeParse((await params).emailEventId);
  if (!parsedId.success) notFound();
  const event = await getAdminEmailEvent(parsedId.data);
  if (!event) notFound();
  const providerPresentation = event.provider_delivery
    ? presentProviderDelivery(event.provider_delivery)
    : null;

  return (
    <section aria-labelledby="admin-email-event-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link
          href="/admin/emails"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Email Operations
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant={event.status === "FAILED" ? "accent" : "outline"}>
            {formatOperationLabel(event.status)}
          </Badge>
          <span className="text-sm font-semibold text-muted-foreground">
            {formatOperationLabel(event.event_type)}
          </span>
        </div>
        <h1 id="admin-email-event-title" className="mt-2 text-3xl font-semibold">
          Email event
        </h1>
        {event.development_adapter ? (
          <p className="mt-2 text-sm font-medium">
            Development adapter — no external email sent
          </p>
        ) : null}
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Minimized operational metadata and one narrowly authorized delivery action.
          Message content, provider identifiers, and raw provider responses are not
          exposed.
        </p>
      </header>

      <section aria-labelledby="email-event-context-title">
        <h2 id="email-event-context-title" className="text-lg font-semibold">
          Operational context
        </h2>
        <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
          <Link
            href={`/admin/businesses/${event.business.id}` as Route}
            className="bg-card p-4 transition-colors hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="size-4" aria-hidden="true" />
              Business
            </span>
            <span className="mt-2 block break-words font-medium">
              {event.business.name}
            </span>
          </Link>
          <Link
            href={`/admin/bookings/${event.booking.id}` as Route}
            className="bg-card p-4 transition-colors hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              Booking
            </span>
            <span className="mt-2 block break-words font-medium">
              {event.booking.reference} · {event.booking.title}
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="email-event-diagnostics-title">
        <h2 id="email-event-diagnostics-title" className="text-lg font-semibold">
          Safe diagnostics
        </h2>
        <dl className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Recipient</dt>
            <dd className="mt-1 break-all font-medium">
              {event.recipient_masked ?? "Not recorded"}
            </dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Attempts</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {event.attempt_count.toLocaleString("en")}
            </dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Failure category</dt>
            <dd className="mt-1 font-medium">
              {formatEmailFailureCategory(event.failure_category)}
            </dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="mt-1 font-medium">{formatDate(event.created_at)}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Last attempt</dt>
            <dd className="mt-1 font-medium">{formatDate(event.last_attempt_at)}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">
              {event.development_adapter
                ? "Development adapter accepted"
                : "Adapter/provider accepted"}
            </dt>
            <dd className="mt-1 font-medium">{formatDate(event.sent_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Mail className="mt-1 size-4 shrink-0" aria-hidden="true" />
          Accepted timestamps indicate adapter or provider acceptance only. Recipient
          delivery, opening, and reading are not tracked.
        </p>
      </section>

      {event.provider_delivery && providerPresentation ? (
        <section aria-labelledby="provider-delivery-title">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" aria-hidden="true" />
            <h2 id="provider-delivery-title" className="text-lg font-semibold">
              Provider delivery
            </h2>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="font-semibold">{providerPresentation.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {providerPresentation.description}
            </p>
            {event.provider_delivery.provider_event_at ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Provider event {formatDate(event.provider_delivery.provider_event_at)}
              </p>
            ) : null}
          </div>
          {event.provider_history && event.provider_history.length > 0 ? (
            <ol className="mt-4 divide-y divide-border border-y border-border">
              {event.provider_history.map((providerEvent) => (
                <li
                  key={providerEvent.id}
                  className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:px-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatOperationLabel(providerEvent.event_type)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatOperationLabel(providerEvent.reason_category)}
                    </p>
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground sm:text-right">
                    <p>Provider {formatDate(providerEvent.provider_event_at)}</p>
                    <p>Received {formatDate(providerEvent.received_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No provider callback evidence has been recorded for this event.
            </p>
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="email-retry-title"
        className="border-y border-border py-6"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {event.retry_eligibility.eligible ? (
                <RotateCw className="size-5 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
              )}
              <h2 id="email-retry-title" className="text-lg font-semibold">
                {event.retry_eligibility.eligible
                  ? "Retry delivery"
                  : "Retry unavailable"}
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {event.development_adapter && event.status === "SENT"
                ? "Retry unavailable: the development adapter completed this operation without sending an external email."
                : event.retry_eligibility.explanation}
            </p>
            <p className="mt-2 text-xs font-medium uppercase text-muted-foreground">
              Classification:{" "}
              {formatOperationLabel(event.retry_eligibility.classification)}
            </p>
          </div>
          {event.retry_eligibility.eligible ? (
            <PrivilegedActionDialog
              actionTitle="Retry this email delivery?"
              consequence="This will make another delivery attempt for the existing transactional email through its original provider."
              triggerLabel="Retry delivery"
              confirmLabel="Retry delivery"
              requiresReason
              action={retryFailedEmailAction.bind(null, event.id)}
            />
          ) : null}
        </div>
      </section>

      <section aria-labelledby="email-attempt-history-title">
        <h2 id="email-attempt-history-title" className="text-lg font-semibold">
          Delivery attempts
        </h2>
        {event.delivery_attempts.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Provider-pinned attempt history is unavailable for this legacy event.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {event.delivery_attempts.map((attempt) => (
              <li
                key={attempt.attempt_number}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={attempt.status === "FAILED" ? "accent" : "outline"}>
                      {formatOperationLabel(attempt.status)}
                    </Badge>
                    <span className="text-sm font-medium">
                      Attempt {attempt.attempt_number.toLocaleString("en")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatOperationLabel(attempt.origin)} ·{" "}
                    {formatOperationLabel(attempt.provider)}
                  </p>
                  {attempt.failure_category ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatEmailFailureCategory(attempt.failure_category)}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{formatDate(attempt.started_at)}</p>
                  <p className="mt-1">Completed {formatDate(attempt.completed_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
