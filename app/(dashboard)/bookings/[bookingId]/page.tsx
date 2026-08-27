import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import {
  BookingDetailSection,
  BookingDetailSections,
} from "@/components/bookings/booking-detail-section";
import { BookingJourney } from "@/components/bookings/booking-journey";
import { BookingLiveSync } from "@/components/bookings/booking-live-sync";
import { BookingPayments } from "@/components/bookings/booking-payments";
import { BookingForm } from "@/components/forms/booking-form";
import { BookingAmendmentPanel } from "@/components/forms/booking-amendment-panel";
import { BookingAddonPanel } from "@/components/forms/booking-addon-panel";
import { BookingIssueForm } from "@/components/forms/booking-issue-form";
import { BookingRescheduleForm } from "@/components/forms/booking-reschedule-form";
import { ConfirmationLinkPanel } from "@/components/forms/confirmation-link-panel";
import { FeedbackLinkPanel } from "@/components/forms/feedback-link-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  completeBookingStatusAction,
  recordBookingPaymentAction,
  rescheduleBookingAction,
  transitionBookingStatusAction,
  updateBookingAction,
  updateBookingInternalNotesAction,
} from "@/features/bookings/actions";
import { formatMoneyMinor, minorUnitsToInput } from "@/features/bookings/money";
import { getDefaultOpenBookingDetailSection } from "@/features/bookings/detail-sections";
import { deriveBookingJourney } from "@/features/bookings/journey";
import {
  getBookingForBusiness,
  getBookingPaymentState,
  listBookingChangesForBusiness,
  listBookingStatusHistoryForBusiness,
} from "@/features/bookings/queries";
import {
  getAllowedBookingTransitions,
  getBookingStatusLabel,
  areMaterialBookingTermsLocked,
  hasCustomerConfirmedTerms,
  isBookingOverdue,
  isTerminalBookingStatus,
} from "@/features/bookings/status";
import {
  generateConfirmationLinkAction,
  recordConfirmationShareAction,
  revokeConfirmationLinkAction,
} from "@/features/confirmation-links/actions";
import { getConfirmationLinkSummaryForBooking } from "@/features/confirmation-links/queries";
import { isConfirmationEligibleStatus } from "@/features/confirmation-links/terms";
import {
  createBookingIssueAction,
  generateFeedbackLinkAction,
  recordFeedbackShareAction,
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
import {
  createBookingAmendmentAction,
  recordAmendmentShareAction,
  revokeBookingAmendmentAction,
} from "@/features/amendments/actions";
import { getBookingAmendmentSummary } from "@/features/amendments/queries";
import {
  amendmentFieldLabels,
  isAmendableBookingStatus,
} from "@/features/amendments/terms";
import {
  cancelBookingAddonAction,
  createBookingAddonAction,
  recordAddonShareAction,
  submitBookingAddonAction,
} from "@/features/addons/actions";
import { getBookingAddonSummary } from "@/features/addons/queries";
import { createBookingLiveState } from "@/features/bookings/live-sync";

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

function BookingIssuesFallback() {
  return (
    <BookingDetailSection
      id="operational-issues"
      title="Operational issues"
      summary="Loading issues"
    >
      <div role="status" aria-label="Loading booking issues" aria-busy="true">
        <span className="sr-only">Loading booking issues</span>
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </BookingDetailSection>
  );
}

async function BookingIssuesSection({
  bookingId,
  issuesPromise,
}: {
  bookingId: string;
  issuesPromise: ReturnType<typeof listBookingIssuesForBooking>;
}) {
  const issues = await issuesPromise;
  const openIssueCount = issues.filter((issue) => issue.status === "OPEN").length;

  return (
    <BookingDetailSection
      id="operational-issues"
      title="Operational issues"
      summary={
        openIssueCount > 0
          ? `${openIssueCount} open issue${openIssueCount === 1 ? "" : "s"}`
          : issues.length > 0
            ? "No open issues"
            : "No issues recorded"
      }
      attention={openIssueCount > 0}
    >
      <div className="space-y-5">
        <BookingIssueForm action={createBookingIssueAction.bind(null, bookingId)} />

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
                        bookingId,
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
      </div>
    </BookingDetailSection>
  );
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

  const issuesPromise = listBookingIssuesForBooking(currentBusiness.id, booking.id);

  const [
    history,
    changes,
    confirmationSummary,
    amendmentSummary,
    addonSummary,
    feedbackSummary,
    feedback,
    paymentState,
  ] = await Promise.all([
    listBookingStatusHistoryForBusiness(currentBusiness.id, booking.id),
    listBookingChangesForBusiness(currentBusiness.id, booking.id),
    getConfirmationLinkSummaryForBooking(currentBusiness.id, booking.id),
    getBookingAmendmentSummary(currentBusiness.id, booking.id),
    getBookingAddonSummary(currentBusiness.id, booking.id, booking),
    getFeedbackLinkSummaryForBooking(currentBusiness.id, booking.id),
    getFeedbackForBooking(currentBusiness.id, booking.id),
    getBookingPaymentState(currentBusiness.id, booking.id),
  ]);
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
      title:
        change.change_type === "amendment"
          ? "Booking amendment confirmed"
          : "Booking rescheduled",
      detail:
        change.change_type === "amendment"
          ? (change.changed_fields ?? [])
              .map((field) =>
                field in amendmentFieldLabels
                  ? amendmentFieldLabels[field as keyof typeof amendmentFieldLabels]
                  : field,
              )
              .join(", ")
          : `${formatDateTime(change.previous_scheduled_for)} to ${formatDateTime(change.new_scheduled_for)}`,
    })),
    ...amendmentSummary.history.flatMap((amendment) => [
      {
        id: `amendment-proposed-${amendment.id}`,
        occurredAt: amendment.submitted_at,
        title: "Booking amendment proposed",
        detail: amendment.reason,
      },
      ...(amendment.status === "REVOKED" && amendment.revoked_at
        ? [
            {
              id: `amendment-revoked-${amendment.id}`,
              occurredAt: amendment.revoked_at,
              title: "Booking amendment revoked",
              detail: "The proposed changes did not alter the booking.",
            },
          ]
        : []),
    ]),
    ...addonSummary.items.flatMap((addon) => [
      {
        id: `addon-created-${addon.id}`,
        occurredAt: addon.created_at,
        title: "Booking add-on created",
        detail: addon.title,
      },
      ...(addon.submitted_at
        ? [
            {
              id: `addon-submitted-${addon.id}`,
              occurredAt: addon.submitted_at,
              title: "Booking add-on submitted",
              detail: "Sent for customer confirmation.",
            },
          ]
        : []),
      ...(addon.confirmed_at
        ? [
            {
              id: `addon-confirmed-${addon.id}`,
              occurredAt: addon.confirmed_at,
              title: "Booking add-on confirmed",
              detail: addon.title,
            },
          ]
        : []),
      ...(addon.cancelled_at
        ? [
            {
              id: `addon-cancelled-${addon.id}`,
              occurredAt: addon.cancelled_at,
              title: "Booking add-on cancelled",
              detail: "The add-on did not change the original booking.",
            },
          ]
        : []),
    ]),
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const rescheduleEligible = [
    "DRAFT",
    "AWAITING_CUSTOMER",
    "CONFIRMED",
    "IN_PROGRESS",
  ].includes(booking.status);
  const scheduleControlled = booking.status !== "DRAFT";
  const overdue = isBookingOverdue({
    scheduledFor: booking.scheduled_for,
    status: booking.status,
  });
  const allowedTransitions = getAllowedBookingTransitions(booking.status);
  const locked = isTerminalBookingStatus(booking.status);
  const materialLocked = areMaterialBookingTermsLocked(booking.status);
  const cancellationReasonRequired = hasCustomerConfirmedTerms(booking.status);
  const canRequestFeedback = isFeedbackEligibleStatus(booking.status) && !feedback;
  const confirmationEverCompleted = Boolean(
    confirmationSummary.confirmedAt ||
    booking.customer_confirmed_at ||
    history.some((event) => event.to_status === "CONFIRMED"),
  );
  const reconfirmationRequired =
    booking.status === "AWAITING_CUSTOMER" &&
    confirmationEverCompleted &&
    changes.some((change) => change.change_type === "reschedule");
  const journey = deriveBookingJourney({
    status: booking.status,
    confirmationLinkStatus: confirmationSummary.status,
    feedbackLinkStatus: feedbackSummary.status,
    feedbackReceived: Boolean(feedback),
    confirmationEverCompleted,
    started: Boolean(booking.started_at),
    ready: Boolean(booking.ready_at),
    delivered: Boolean(booking.delivered_at),
    completed: Boolean(booking.completed_at),
    reconfirmationRequired,
    pendingAmendment: amendmentSummary.displayStatus === "pending",
    awaitingAddon: addonSummary.hasAwaitingAddon,
    outstandingAmountMinor: paymentState.summary?.outstandingAmountMinor ?? null,
  });
  const liveState = createBookingLiveState({
    status: booking.status,
    updatedAt: booking.updated_at,
    customerConfirmedAt: booking.customer_confirmed_at,
    feedbackSubmittedAt: feedback?.submitted_at ?? null,
  });
  const defaultOpenSection = getDefaultOpenBookingDetailSection({
    status: booking.status,
    feedbackReceived: Boolean(feedback),
    pendingAmendment: amendmentSummary.displayStatus === "pending",
    awaitingAddon: addonSummary.hasAwaitingAddon,
  });
  const confirmationSectionSummary = confirmationSummary.confirmedAt
    ? "Customer confirmed"
    : confirmationSummary.status === "active"
      ? "Confirmation link ready - awaiting customer"
      : "Awaiting customer confirmation";
  const paymentSectionSummary = paymentState.summary
    ? paymentState.summary.outstandingAmountMinor > 0
      ? `${formatMoneyMinor(paymentState.summary.outstandingAmountMinor, paymentState.summary.currency)} outstanding`
      : "Payment fully recorded"
    : "Payment status unavailable";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <BookingLiveSync bookingId={booking.id} initialState={liveState} />
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
          {booking.customer?.name ?? "Customer unavailable"} · Scheduled delivery{" "}
          {formatDateTime(booking.scheduled_for)}
        </p>
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

      {query.message === "invalid-status" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          That status action is not valid. The journey below reflects the current saved
          booking state.
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

      <BookingJourney
        journey={journey}
        transitionAction={transitionBookingStatusAction.bind(null, booking.id)}
        completionAction={completeBookingStatusAction.bind(null, booking.id)}
        canCancel={allowedTransitions.includes("CANCELLED")}
        cancellationReasonRequired={cancellationReasonRequired}
        canReschedule={rescheduleEligible}
        canAmend={isAmendableBookingStatus(booking.status)}
        canAdd={isAmendableBookingStatus(booking.status)}
        cancelledAt={booking.cancelled_at}
        cancellationReason={booking.cancellation_reason}
      />

      <BookingDetailSections>
        <BookingDetailSection
          id="booking-payments"
          title="Payment & completion"
          summary={paymentSectionSummary}
          defaultOpen={defaultOpenSection === "booking-payments"}
          attention={
            booking.status === "DELIVERED" &&
            (paymentState.summary?.outstandingAmountMinor ?? 0) > 0
          }
        >
          <BookingPayments
            summary={paymentState.summary}
            payments={paymentState.payments}
            canRecordPayment={["IN_PROGRESS", "READY", "DELIVERED"].includes(
              booking.status,
            )}
            action={recordBookingPaymentAction.bind(null, booking.id)}
            embedded
          />
        </BookingDetailSection>

        <BookingDetailSection
          id="operational-progress"
          title="Operational progress"
          summary={getBookingStatusLabel(booking.status)}
          defaultOpen={defaultOpenSection === "operational-progress"}
        >
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
        </BookingDetailSection>

        <BookingDetailSection
          id="customer-confirmation"
          title="Customer confirmation"
          summary={confirmationSectionSummary}
          defaultOpen={defaultOpenSection === "customer-confirmation"}
          attention={booking.status === "AWAITING_CUSTOMER"}
        >
          <ConfirmationLinkPanel
            summary={confirmationSummary}
            canManage={isConfirmationEligibleStatus(booking.status)}
            businessName={currentBusiness.name}
            customerName={booking.customer?.name ?? null}
            customerProfileEmail={booking.customer?.email ?? null}
            generateAction={generateConfirmationLinkAction.bind(null, booking.id)}
            revokeAction={revokeConfirmationLinkAction.bind(null, booking.id)}
            recordShareAction={recordConfirmationShareAction.bind(null, booking.id)}
          />
        </BookingDetailSection>

        <BookingDetailSection
          id="booking-changes"
          title="Booking changes"
          summary={
            amendmentSummary.displayStatus === "pending"
              ? "Customer action required"
              : amendmentSummary.history.length === 0
                ? "No changes"
                : `${amendmentSummary.history.length} change request${amendmentSummary.history.length === 1 ? "" : "s"}`
          }
          defaultOpen={defaultOpenSection === "booking-changes"}
          attention={amendmentSummary.displayStatus === "pending"}
        >
          <BookingAmendmentPanel
            summary={amendmentSummary}
            canPropose={
              isAmendableBookingStatus(booking.status) && !addonSummary.hasAwaitingAddon
            }
            businessName={currentBusiness.name}
            customerName={booking.customer?.name ?? null}
            initialValues={{
              title: booking.title,
              description: booking.description,
              currency: booking.currency,
              totalAmount: minorUnitsToInput(booking.total_amount_minor),
              depositAmount: minorUnitsToInput(booking.deposit_amount_minor),
              scheduledFor: booking.scheduled_for,
            }}
            createAction={createBookingAmendmentAction.bind(null, booking.id)}
            revokeAction={revokeBookingAmendmentAction.bind(
              null,
              booking.id,
              amendmentSummary.latest?.id ?? "",
            )}
            recordShareAction={recordAmendmentShareAction.bind(null, booking.id)}
          />
        </BookingDetailSection>

        <BookingDetailSection
          id="booking-addons"
          title="Booking add-ons"
          summary={
            addonSummary.hasAwaitingAddon
              ? "Customer action required"
              : addonSummary.confirmedAddonCount > 0
                ? `${addonSummary.confirmedAddonCount} confirmed`
                : "No confirmed add-ons"
          }
          defaultOpen={defaultOpenSection === "booking-addons"}
          attention={addonSummary.hasAwaitingAddon}
        >
          <BookingAddonPanel
            summary={addonSummary}
            canCreate={isAmendableBookingStatus(booking.status)}
            requestBlocked={
              amendmentSummary.displayStatus === "pending" ||
              addonSummary.hasAwaitingAddon
            }
            currency={booking.currency}
            originalTotalAmountMinor={booking.total_amount_minor}
            originalDepositAmountMinor={booking.deposit_amount_minor}
            businessName={currentBusiness.name}
            customerName={booking.customer?.name ?? null}
            createAction={createBookingAddonAction.bind(null, booking.id)}
            submitAction={submitBookingAddonAction.bind(null, booking.id)}
            cancelAction={cancelBookingAddonAction.bind(null, booking.id)}
            recordShareAction={recordAddonShareAction.bind(null, booking.id)}
          />
        </BookingDetailSection>

        <BookingDetailSection
          id="private-feedback"
          title="Private feedback"
          summary={
            feedback
              ? "Feedback received"
              : booking.status === "COMPLETED"
                ? feedbackSummary.status === "active"
                  ? "Feedback request ready"
                  : "Not requested"
                : "Available after completion"
          }
          defaultOpen={defaultOpenSection === "private-feedback"}
          attention={booking.status === "COMPLETED" && !feedback}
        >
          {feedback ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Overall rating
                  </p>
                  <p className="mt-1 text-sm font-medium">{feedback.overall_rating}/5</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">On time</p>
                  <p className="mt-1 text-sm">{feedback.on_time ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Met expectations
                  </p>
                  <p className="mt-1 text-sm">
                    {feedback.met_expectations ? "Yes" : "No"}
                  </p>
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
              businessName={currentBusiness.name}
              customerName={booking.customer?.name ?? null}
              recordShareAction={recordFeedbackShareAction.bind(null, booking.id)}
            />
          )}
        </BookingDetailSection>

        <Suspense fallback={<BookingIssuesFallback />}>
          <BookingIssuesSection bookingId={booking.id} issuesPromise={issuesPromise} />
        </Suspense>

        <BookingDetailSection
          id="reschedule"
          title="Reschedule"
          summary={`Scheduled ${formatDateTime(booking.scheduled_for)}`}
        >
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
        </BookingDetailSection>

        <BookingDetailSection
          id="booking-details"
          title={
            locked
              ? "Booking details"
              : materialLocked
                ? "Customer-confirmed details"
                : "Edit booking"
          }
          summary={`${booking.reference} - ${formatDateTime(booking.scheduled_for)}`}
        >
          <BookingForm
            action={(materialLocked
              ? updateBookingInternalNotesAction
              : updateBookingAction
            ).bind(null, booking.id)}
            submitLabel={materialLocked ? "Save internal notes" : "Save booking"}
            mode="edit"
            disabled={locked}
            scheduledDisabled={scheduleControlled}
            materialDisabled={materialLocked}
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
          ) : materialLocked ? (
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Customer-confirmed booking details are locked. Use Booking changes for
              customer-approved material changes, or Reschedule for the existing date-only
              reconfirmation workflow.
            </p>
          ) : null}
        </BookingDetailSection>

        <BookingDetailSection
          id="operational-timeline"
          title="Operational timeline"
          summary={`${timeline.length} event${timeline.length === 1 ? "" : "s"}`}
        >
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-muted-foreground">{event.detail}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </BookingDetailSection>
      </BookingDetailSections>
    </main>
  );
}
