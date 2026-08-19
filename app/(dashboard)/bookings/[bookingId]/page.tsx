import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { BookingForm } from "@/components/forms/booking-form";
import { BookingIssueForm } from "@/components/forms/booking-issue-form";
import { BookingRescheduleForm } from "@/components/forms/booking-reschedule-form";
import { BookingStatusForm } from "@/components/forms/booking-status-form";
import { ConfirmationLinkPanel } from "@/components/forms/confirmation-link-panel";
import { FeedbackLinkPanel } from "@/components/forms/feedback-link-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  rescheduleBookingAction,
  transitionBookingStatusAction,
  updateBookingAction,
} from "@/features/bookings/actions";
import { formatMoneyMinor, deriveBalanceMinor, minorUnitsToInput } from "@/features/bookings/money";
import {
  getBookingForBusiness,
  listBookingChangesForBusiness,
  listBookingStatusHistoryForBusiness,
} from "@/features/bookings/queries";
import {
  getAllowedBookingTransitions,
  getBookingStatusLabel,
  getTransitionLabel,
  isBookingOverdue,
  isTerminalBookingStatus,
} from "@/features/bookings/status";
import {
  generateConfirmationLinkAction,
  revokeConfirmationLinkAction,
} from "@/features/confirmation-links/actions";
import { getConfirmationLinkSummaryForBooking } from "@/features/confirmation-links/queries";
import { isConfirmationEligibleStatus } from "@/features/confirmation-links/terms";
import {
  createBookingIssueAction,
  generateFeedbackLinkAction,
  resolveBookingIssueAction,
  revokeFeedbackLinkAction,
} from "@/features/feedback/actions";
import {
  getFeedbackForBooking,
  getFeedbackLinkSummaryForBooking,
  listBookingIssuesForBooking,
} from "@/features/feedback/queries";
import {
  isFeedbackEligibleStatus,
  issueCategoryLabels,
} from "@/features/feedback/validation";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type BookingDetailPageProps = {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function nextStepDescription(status: string) {
  if (status === "DRAFT" || status === "AWAITING_CUSTOMER") {
    return "Send a confirmation link when the customer is ready to approve the booking.";
  }

  if (status === "CONFIRMED") {
    return "The customer has confirmed the booking. Start work when you are ready.";
  }

  if (status === "IN_PROGRESS") {
    return "Work has started. Mark the booking ready when it is prepared for delivery or pickup.";
  }

  if (status === "READY") {
    return "The booking is ready. Mark it delivered when the customer has received it.";
  }

  if (status === "DELIVERED") {
    return "The booking has been delivered. Complete it when no further fulfilment work remains.";
  }

  if (status === "COMPLETED") {
    return "This booking is complete. You can request private feedback from the customer.";
  }

  if (status === "CANCELLED") {
    return "This booking was cancelled and is locked.";
  }

  return "Review the current booking state and choose the next action.";
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: BookingDetailPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const { bookingId } = await params;
  const query = (await searchParams) ?? {};
  const booking = await getBookingForBusiness(currentBusiness.id, bookingId);

  if (!booking) {
    notFound();
  }

  const [history, confirmationSummary, feedbackSummary, feedback, issues] = await Promise.all([
    listBookingStatusHistoryForBusiness(currentBusiness.id, booking.id),
    getConfirmationLinkSummaryForBooking(currentBusiness.id, booking.id),
    getFeedbackLinkSummaryForBooking(currentBusiness.id, booking.id),
    getFeedbackForBooking(currentBusiness.id, booking.id),
    listBookingIssuesForBooking(currentBusiness.id, booking.id),
  ]);
  const changes = await listBookingChangesForBusiness(currentBusiness.id, booking.id);
  const timeline = [
    ...history.map((event) => ({
      id: `status-${event.id}`,
      occurredAt: event.changed_at,
      title: event.from_status
        ? `${getBookingStatusLabel(event.from_status)} to ${getBookingStatusLabel(event.to_status)}`
        : `Created as ${getBookingStatusLabel(event.to_status)}`,
      detail: "Status history",
    })),
    ...changes.map((change) => ({
      id: `change-${change.id}`,
      occurredAt: change.created_at,
      title: "Booking rescheduled",
      detail: `${formatDateTime(change.previous_scheduled_for)} to ${formatDateTime(change.new_scheduled_for)}`,
    })),
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const rescheduleEligible = ["DRAFT", "AWAITING_CUSTOMER", "CONFIRMED"].includes(booking.status);
  const scheduleControlled = booking.status !== "DRAFT";
  const balance = deriveBalanceMinor(booking.total_amount_minor, booking.deposit_amount_minor);
  const overdue = isBookingOverdue({
    scheduledFor: booking.scheduled_for,
    status: booking.status,
  });
  const allowedTransitions = getAllowedBookingTransitions(booking.status);
  const locked = isTerminalBookingStatus(booking.status);
  const canRequestFeedback = isFeedbackEligibleStatus(booking.status) && !feedback;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={"/bookings" as Route}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Bookings
            </Link>
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{booking.reference}</Badge>
            <Badge variant={overdue ? "accent" : "default"}>
              {overdue ? "Overdue" : getBookingStatusLabel(booking.status)}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
            {booking.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {booking.customer?.name ?? "Customer unavailable"} · Scheduled {formatDateTime(booking.scheduled_for)}
          </p>
        </div>

        <div className="w-full rounded-lg border border-border bg-card p-4 lg:max-w-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next step
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {nextStepDescription(booking.status)}
          </p>
          {allowedTransitions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {allowedTransitions.map((status) => (
                <BookingStatusForm
                  key={status}
                  action={transitionBookingStatusAction.bind(null, booking.id, status)}
                  label={getTransitionLabel(status)}
                  variant={status === "CANCELLED" ? "destructive" : "secondary"}
                  confirmMessage={
                    status === "CANCELLED" || status === "COMPLETED"
                      ? `Confirm ${getBookingStatusLabel(status).toLowerCase()}?`
                      : undefined
                  }
                  cancellationReason={status === "CANCELLED"}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {query.created === "1" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Booking created.
        </p>
      ) : null}

      {query.message === "status-updated" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Booking status updated.
        </p>
      ) : null}

      {query.message === "invalid-transition" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          This status change is not available for the current booking state.
        </p>
      ) : null}

      {query.message === "issue-resolved" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Issue resolved.
        </p>
      ) : null}

      {query.message === "issue-created" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Issue created.
        </p>
      ) : null}

      {query.message === "issue-resolution-unavailable" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          This issue could not be resolved.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Agreed total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatMoneyMinor(booking.total_amount_minor, booking.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deposit recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatMoneyMinor(booking.deposit_amount_minor, booking.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatMoneyMinor(balance, booking.currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Started</p>
              <p className="mt-1 text-sm">{formatDateTime(booking.started_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Ready</p>
              <p className="mt-1 text-sm">{formatDateTime(booking.ready_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Delivered</p>
              <p className="mt-1 text-sm">{formatDateTime(booking.delivered_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed</p>
              <p className="mt-1 text-sm">{formatDateTime(booking.completed_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cancelled</p>
              <p className="mt-1 text-sm">{formatDateTime(booking.cancelled_at)}</p>
            </div>
          </div>
          {booking.cancellation_reason ? (
            <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Cancellation reason: {booking.cancellation_reason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer confirmation</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfirmationLinkPanel
            summary={confirmationSummary}
            canManage={isConfirmationEligibleStatus(booking.status)}
            generateAction={generateConfirmationLinkAction.bind(null, booking.id)}
            revokeAction={revokeConfirmationLinkAction.bind(null, booking.id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Private feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Overall rating</p>
                  <p className="mt-1 text-sm font-medium">{feedback.overall_rating}/5</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">On time</p>
                  <p className="mt-1 text-sm">{feedback.on_time ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Met expectations</p>
                  <p className="mt-1 text-sm">{feedback.met_expectations ? "Yes" : "No"}</p>
                </div>
              </div>
              {feedback.comment ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                  {feedback.comment}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Submitted {formatDateTime(feedback.submitted_at)}
              </p>
            </div>
          ) : (
            <FeedbackLinkPanel
              summary={feedbackSummary}
              canManage={canRequestFeedback}
              generateAction={generateFeedbackLinkAction.bind(null, booking.id)}
              revokeAction={revokeFeedbackLinkAction.bind(null, booking.id)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operational issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <BookingIssueForm action={createBookingIssueAction.bind(null, booking.id)} />

          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues recorded.</p>
          ) : (
            <ol className="space-y-3">
              {issues.map((issue) => (
                <li key={issue.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{issueCategoryLabels[issue.category]}</p>
                        <Badge variant={issue.status === "OPEN" ? "accent" : "outline"}>
                          {issue.status === "OPEN" ? "Open" : "Resolved"}
                        </Badge>
                      </div>
                      <p className="mt-2 leading-6 text-muted-foreground">
                        {issue.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Created {formatDateTime(issue.created_at)}
                        {issue.resolved_at
                          ? ` · Resolved ${formatDateTime(issue.resolved_at)}`
                          : ""}
                      </p>
                    </div>
                    {issue.status === "OPEN" ? (
                      <form
                        action={resolveBookingIssueAction.bind(
                          null,
                          booking.id,
                          issue.id,
                          issue.status,
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          Resolve
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reschedule</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingRescheduleForm
            action={rescheduleBookingAction.bind(null, booking.id)}
            currentScheduledFor={booking.scheduled_for}
            disabled={!rescheduleEligible}
          />
          {!rescheduleEligible ? (
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Rescheduling is only available before operational work starts.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{locked ? "Booking details" : "Edit booking"}</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingForm
            action={updateBookingAction.bind(null, booking.id)}
            submitLabel="Save booking"
            mode="edit"
            disabled={locked}
            scheduledDisabled={scheduleControlled}
            initialValues={{
              title: booking.title,
              description: booking.description,
              currency: booking.currency,
              totalAmount: minorUnitsToInput(booking.total_amount_minor),
              depositAmount: minorUnitsToInput(booking.deposit_amount_minor),
              scheduledFor: booking.scheduled_for,
              internalNotes: booking.internal_notes,
            }}
          />
          {locked ? (
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Completed and cancelled bookings are locked.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operational timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((event) => (
                <li key={event.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-muted-foreground">{event.detail}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
