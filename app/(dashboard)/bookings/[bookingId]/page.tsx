import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MessageSquareQuote,
  Star,
  Timer,
  UserRound,
} from "lucide-react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import {
  BookingDetailSection,
  BookingDetailSections,
} from "@/components/bookings/booking-detail-section";
import { BookingJourney } from "@/components/bookings/booking-journey";
import { BookingIssuesPanel } from "@/components/bookings/booking-issues-panel";
import { BookingLiveSync } from "@/components/bookings/booking-live-sync";
import { BookingOperationalProgress } from "@/components/bookings/booking-operational-progress";
import {
  BookingOperationalTimeline,
  formatTimelineEventCount,
} from "@/components/bookings/booking-operational-timeline";
import { BookingPayments } from "@/components/bookings/booking-payments";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingForm } from "@/components/forms/booking-form";
import { BookingAmendmentPanel } from "@/components/forms/booking-amendment-panel";
import { BookingAddonPanel } from "@/components/forms/booking-addon-panel";
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
  sendConfirmationEmailAction,
} from "@/features/confirmation-links/actions";
import {
  getConfirmationDeliveryForBooking,
  getConfirmationLinkSummaryForBooking,
} from "@/features/confirmation-links/queries";
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
import { isFeedbackEligibleStatus } from "@/features/feedback/validation";
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
      icon="issues"
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

  return (
    <BookingIssuesPanel
      issues={issues}
      createAction={createBookingIssueAction.bind(null, bookingId)}
      resolveAction={resolveBookingIssueAction.bind(null, bookingId)}
    />
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
    confirmationDelivery,
    amendmentSummary,
    addonSummary,
    feedbackSummary,
    feedback,
    paymentState,
  ] = await Promise.all([
    listBookingStatusHistoryForBusiness(currentBusiness.id, booking.id),
    listBookingChangesForBusiness(currentBusiness.id, booking.id),
    getConfirmationLinkSummaryForBooking(currentBusiness.id, booking.id),
    getConfirmationDeliveryForBooking(booking.id),
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
    providerDeliveryStatus: confirmationDelivery?.provider_delivery_status ?? "UNKNOWN",
    providerEventAt: confirmationDelivery?.provider_event_at ?? null,
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
      ? "Awaiting customer"
      : confirmationSummary.status === "expired"
        ? "Link expired"
        : confirmationSummary.status === "revoked"
          ? "Link revoked"
          : confirmationSummary.status === "used"
            ? "Customer confirmed"
            : "Not generated";
  const paymentSectionSummary = paymentState.summary
    ? paymentState.summary.outstandingAmountMinor > 0
      ? `${formatMoneyMinor(paymentState.summary.outstandingAmountMinor, paymentState.summary.currency)} outstanding`
      : "Payment fully recorded"
    : "Payment status unavailable";
  const feedbackSectionSummary = feedback
    ? "Feedback received"
    : !isFeedbackEligibleStatus(booking.status)
      ? "Available after delivery"
      : feedbackSummary.status === "active"
        ? "Feedback request ready"
        : feedbackSummary.status === "expired"
          ? "Feedback request expired"
          : feedbackSummary.status === "revoked"
            ? "Feedback request revoked"
            : feedbackSummary.status === "submitted"
              ? "Feedback received"
              : "Not requested";

  return (
    <WorkspacePage className="max-w-6xl gap-4 sm:gap-6">
      <BookingLiveSync bookingId={booking.id} initialState={liveState} />
      <div className="min-w-0">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 px-2 text-muted-foreground"
        >
          <Link href={"/bookings" as Route}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Bookings
          </Link>
        </Button>
        <section
          className="mt-3 rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(23,33,29,0.04)] sm:p-5"
          aria-labelledby="booking-detail-title"
          data-booking-identity
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="max-w-full break-all border-border bg-muted/45 px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {booking.reference}
            </Badge>
            <BookingStatusBadge
              status={booking.status}
              overdue={overdue}
              className="px-2.5 py-1 text-xs font-semibold"
            />
          </div>
          <h1
            id="booking-detail-title"
            className="mt-3 break-words text-[1.625rem] font-semibold leading-tight sm:text-3xl"
          >
            {booking.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="break-words">
                {booking.customer?.name ?? "Customer unavailable"}
              </span>
            </span>
            <span className="hidden text-border sm:inline" aria-hidden="true">
              •
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="break-words">
                Scheduled delivery {formatDateTime(booking.scheduled_for)}
              </span>
            </span>
          </div>
        </section>
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
          icon="wallet"
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
          icon="progress"
          defaultOpen={defaultOpenSection === "operational-progress"}
        >
          <BookingOperationalProgress
            started={{
              value: booking.started_at,
              displayValue: formatDateTime(booking.started_at),
            }}
            ready={{
              value: booking.ready_at,
              displayValue: formatDateTime(booking.ready_at),
            }}
            delivered={{
              value: booking.delivered_at,
              displayValue: formatDateTime(booking.delivered_at),
            }}
            completed={{
              value: booking.completed_at,
              displayValue: formatDateTime(booking.completed_at),
            }}
            cancelled={{
              value: booking.cancelled_at,
              displayValue: formatDateTime(booking.cancelled_at),
            }}
          />
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
          icon="link"
        >
          <ConfirmationLinkPanel
            summary={confirmationSummary}
            providerDelivery={confirmationDelivery}
            canManage={isConfirmationEligibleStatus(booking.status)}
            businessName={currentBusiness.name}
            customerName={booking.customer?.name ?? null}
            customerProfileEmail={booking.customer?.email ?? null}
            generateAction={generateConfirmationLinkAction.bind(null, booking.id)}
            sendAction={sendConfirmationEmailAction.bind(null, booking.id)}
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
          icon="changes"
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
          icon="addon"
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
          summary={feedbackSectionSummary}
          icon="feedback"
          defaultOpen={defaultOpenSection === "private-feedback"}
          attention={isFeedbackEligibleStatus(booking.status) && !feedback}
        >
          {feedback ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                    <Star className="size-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Overall rating
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {feedback.overall_rating}/5
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                    <Timer className="size-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">On time</p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {feedback.on_time ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                    <CheckCircle2 className="size-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Met expectations
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {feedback.met_expectations ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </div>
              {feedback.comment ? (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <MessageSquareQuote
                    className="mt-0.5 size-[1.125rem] shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 break-words text-sm leading-6 text-muted-foreground">
                    {feedback.comment}
                  </p>
                </div>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
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
          icon="reschedule"
        >
          <BookingRescheduleForm
            action={rescheduleBookingAction.bind(null, booking.id)}
            currentScheduledFor={booking.scheduled_for}
            disabled={!rescheduleEligible}
            reconfirmationExpected={confirmationEverCompleted}
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
          summary={`${booking.reference} • ${formatDateTime(booking.scheduled_for)}`}
          icon="edit"
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
          summary={formatTimelineEventCount(timeline.length)}
          icon="timeline"
        >
          <BookingOperationalTimeline
            events={timeline}
            formatTimestamp={formatDateTime}
          />
        </BookingDetailSection>
      </BookingDetailSections>
    </WorkspacePage>
  );
}
