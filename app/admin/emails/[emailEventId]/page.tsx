import { ArrowLeft, Building2, CalendarDays, Mail } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { formatEmailFailureCategory } from "@/features/admin/email-operations";
import { formatOperationLabel } from "@/features/admin/operations";
import { getAdminEmailEvent } from "@/features/admin/queries";

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
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Read-only operational metadata. Message content, provider identifiers, and raw
          provider responses are not exposed.
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
            <dt className="text-sm text-muted-foreground">Accepted</dt>
            <dd className="mt-1 font-medium">{formatDate(event.sent_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Mail className="mt-1 size-4 shrink-0" aria-hidden="true" />
          Accepted timestamps indicate adapter or provider acceptance only. Recipient
          delivery, opening, and reading are not tracked.
        </p>
      </section>
    </section>
  );
}
