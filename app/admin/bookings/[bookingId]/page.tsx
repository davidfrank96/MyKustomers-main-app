import { ArrowLeft, Building2, CircleAlert, UserRound } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { formatOperationLabel } from "@/features/admin/operations";
import { getAdminBooking } from "@/features/admin/queries";
import { deriveBalanceMinor, formatMoneyMinor } from "@/features/bookings/money";

export const metadata: Metadata = { title: "Booking operations | Platform administration" };

type PageProps = { params: Promise<{ bookingId: string }> };

const uuidSchema = z.string().uuid();
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  return value ? `${dateTimeFormatter.format(new Date(value))} UTC` : "Not recorded";
}

function BooleanValue({ value }: { value: boolean }) {
  return <span>{value ? "Yes" : "No"}</span>;
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  const parsedId = uuidSchema.safeParse((await params).bookingId);
  if (!parsedId.success) notFound();
  const booking = await getAdminBooking(parsedId.data);
  if (!booking) notFound();

  const balance = deriveBalanceMinor(
    booking.effective_total_amount_minor,
    booking.effective_deposit_amount_minor,
  );

  return (
    <section aria-labelledby="admin-booking-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Bookings
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">{booking.reference}</span>
          <Badge variant="outline">{formatOperationLabel(booking.status)}</Badge>
        </div>
        <h1 id="admin-booking-title" className="mt-2 break-words text-3xl font-semibold">
          {booking.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href={`/admin/businesses/${booking.business.id}` as Route} className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Building2 className="size-4" aria-hidden="true" />
            {booking.business.name}
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" aria-hidden="true" />
            {booking.customer.name}
          </span>
          <Link href={`/admin/users/${booking.creator.id}` as Route} className="inline-flex items-center gap-1.5 font-medium text-primary">
            <UserRound className="size-4" aria-hidden="true" />
            Created by {booking.creator.display_name ?? booking.creator.email ?? "account"}
          </Link>
        </div>
      </header>

      <section aria-labelledby="booking-financial-title">
        <h2 id="booking-financial-title" className="text-lg font-semibold">Financial summary</h2>
        <dl className="mt-4 grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[
            ["Canonical total", booking.canonical_total_amount_minor],
            ["Effective total", booking.effective_total_amount_minor],
            ["Effective deposit", booking.effective_deposit_amount_minor],
            ["Effective balance", balance],
          ].map(([label, value]) => (
            <div key={label} className="bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 break-words text-xl font-semibold">
                {formatMoneyMinor(value as number, booking.currency)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="booking-lifecycle-title">
        <h2 id="booking-lifecycle-title" className="text-lg font-semibold">Lifecycle</h2>
        <dl className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Created", booking.created_at],
            ["Scheduled", booking.scheduled_for],
            ["Started", booking.started_at],
            ["Ready", booking.ready_at],
            ["Delivered", booking.delivered_at],
            ["Completed", booking.completed_at],
            ["Cancelled", booking.cancelled_at],
          ].map(([label, value]) => (
            <div key={label} className="bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-medium">{formatDate(value)}</dd>
            </div>
          ))}
          <div className="bg-card p-4 sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Cancellation reason</dt>
            <dd className="mt-1 break-words font-medium">{booking.cancellation_reason ?? "Not applicable"}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="booking-confirmation-title">
        <h2 id="booking-confirmation-title" className="text-lg font-semibold">Customer confirmation</h2>
        <div className="mt-4 border-y border-border py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatOperationLabel(booking.confirmation.state)}</Badge>
            <span className="text-sm text-muted-foreground">Confirmed {formatDate(booking.confirmation.confirmed_at)}</span>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-muted-foreground">Verified email</dt><dd className="mt-1 font-medium">{booking.confirmation.contact_email_masked ?? "Not recorded"}</dd></div>
            <div><dt className="text-muted-foreground">Verified phone</dt><dd className="mt-1 font-medium">{booking.confirmation.contact_phone_masked ?? "Not recorded"}</dd></div>
            <div><dt className="text-muted-foreground">Confirmed terms</dt><dd className="mt-1 font-medium">{booking.confirmation.terms ? "Recorded" : "Not recorded"}</dd></div>
          </dl>
          {booking.confirmation.terms ? (
            <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {booking.confirmation.terms.title ? <div><dt className="text-muted-foreground">Confirmed title</dt><dd className="mt-1 break-words font-medium">{booking.confirmation.terms.title}</dd></div> : null}
              {booking.confirmation.terms.scheduled_for ? <div><dt className="text-muted-foreground">Confirmed schedule</dt><dd className="mt-1 font-medium">{formatDate(booking.confirmation.terms.scheduled_for)}</dd></div> : null}
              {booking.confirmation.terms.total_amount_minor !== undefined && booking.confirmation.terms.currency ? <div><dt className="text-muted-foreground">Confirmed total</dt><dd className="mt-1 font-medium">{formatMoneyMinor(booking.confirmation.terms.total_amount_minor, booking.confirmation.terms.currency)}</dd></div> : null}
            </dl>
          ) : null}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="booking-amendments-title">
          <h2 id="booking-amendments-title" className="text-lg font-semibold">Amendments</h2>
          {booking.amendments.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No amendments recorded.</p> : (
            <div className="mt-4 divide-y divide-border border-y border-border">
              {booking.amendments.map((item) => (
                <article key={item.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{formatOperationLabel(item.status)}</Badge><span className="text-sm text-muted-foreground">{formatDate(item.created_at)}</span></div>
                  <p className="mt-2 break-words text-sm">{item.reason}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Fields: {item.changed_fields.map(formatOperationLabel).join(", ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDate(item.submitted_at)} · Confirmed {formatDate(item.confirmed_at)} · Revoked {formatDate(item.revoked_at)}
                  </p>
                  {item.revoked_reason ? <p className="mt-1 break-words text-xs text-muted-foreground">Revocation: {item.revoked_reason}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="booking-addons-title">
          <h2 id="booking-addons-title" className="text-lg font-semibold">Add-ons</h2>
          {booking.addons.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No add-ons recorded.</p> : (
            <div className="mt-4 divide-y divide-border border-y border-border">
              {booking.addons.map((item) => (
                <article key={item.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant="outline">{formatOperationLabel(item.status)}</Badge></div>
                  <p className="mt-2 text-sm text-muted-foreground">Total {formatMoneyMinor(item.total_amount_minor, item.currency)} · Deposit {formatMoneyMinor(item.deposit_amount_minor, item.currency)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Created {formatDate(item.created_at)} · Submitted {formatDate(item.submitted_at)} · Confirmed {formatDate(item.confirmed_at)}</p>
                  {item.cancelled_at ? <p className="mt-1 break-words text-xs text-muted-foreground">Cancelled {formatDate(item.cancelled_at)}{item.cancellation_reason ? ` · ${item.cancellation_reason}` : ""}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="booking-history-title">
        <h2 id="booking-history-title" className="text-lg font-semibold">Status history</h2>
        {booking.status_history.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No status history recorded.</p> : (
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {booking.status_history.map((item, index) => (
              <li key={`${item.changed_at}-${index}`} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="font-medium">{item.from_status ? formatOperationLabel(item.from_status) : "Created"} → {formatOperationLabel(item.to_status)}</span>
                <time className="text-sm text-muted-foreground">{formatDate(item.changed_at)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="booking-changes-title">
        <h2 id="booking-changes-title" className="text-lg font-semibold">Material changes</h2>
        {booking.changes.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No material changes recorded.</p> : (
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {booking.changes.map((item, index) => (
              <li key={`${item.created_at}-${index}`} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{formatOperationLabel(item.change_type)}</span><time className="text-sm text-muted-foreground">{formatDate(item.created_at)}</time></div>
                {item.change_type === "reschedule" ? <p className="mt-2 text-sm text-muted-foreground">{formatDate(item.previous_scheduled_for)} → {formatDate(item.new_scheduled_for)}</p> : null}
                {item.changed_fields?.length ? <p className="mt-2 text-sm text-muted-foreground">Fields: {item.changed_fields.map(formatOperationLabel).join(", ")}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="booking-feedback-title">
          <h2 id="booking-feedback-title" className="text-lg font-semibold">Feedback summary</h2>
          {booking.feedback ? (
            <dl className="mt-4 grid grid-cols-2 gap-px bg-border">
              <div className="bg-card p-4"><dt className="text-sm text-muted-foreground">Rating</dt><dd className="mt-1 font-semibold">{booking.feedback.overall_rating} / 5</dd></div>
              <div className="bg-card p-4"><dt className="text-sm text-muted-foreground">On time</dt><dd className="mt-1 font-semibold"><BooleanValue value={booking.feedback.on_time} /></dd></div>
              <div className="bg-card p-4"><dt className="text-sm text-muted-foreground">Met expectations</dt><dd className="mt-1 font-semibold"><BooleanValue value={booking.feedback.met_expectations} /></dd></div>
              <div className="bg-card p-4"><dt className="text-sm text-muted-foreground">Submitted</dt><dd className="mt-1 font-semibold">{formatDate(booking.feedback.submitted_at)}</dd></div>
            </dl>
          ) : <p className="mt-4 text-sm text-muted-foreground">No feedback submitted.</p>}
        </section>

        <section aria-labelledby="booking-email-title">
          <h2 id="booking-email-title" className="text-lg font-semibold">Email event summary</h2>
          {booking.email_summary.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No email events recorded.</p> : (
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {booking.email_summary.map((item) => (
                <div key={`${item.event_type}-${item.status}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt>{formatOperationLabel(item.event_type)} · {formatOperationLabel(item.status)}</dt>
                  <dd className="font-semibold tabular-nums">{item.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section aria-labelledby="booking-issues-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="booking-issues-title" className="text-lg font-semibold">Issues</h2><Link href={`/admin/issues?business=${booking.business.id}` as Route} className="text-sm font-medium text-primary">Business issues</Link></div>
        {booking.issues.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No issues recorded.</p> : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {booking.issues.map((issue) => (
              <Link key={issue.id} href={`/admin/issues/${issue.id}` as Route} className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/40 sm:px-3">
                <span className="inline-flex min-w-0 items-center gap-2"><CircleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-words font-medium">{formatOperationLabel(issue.category)}</span></span>
                <Badge variant={issue.status === "OPEN" ? "accent" : "outline"}>{formatOperationLabel(issue.status)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
