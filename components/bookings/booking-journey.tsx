import { AlertTriangle, Check, Circle, Clock3, X } from "lucide-react";
import { BookingCompletionDialog } from "@/components/forms/booking-completion-dialog";
import { BookingStatusForm } from "@/components/forms/booking-status-form";
import { Button } from "@/components/ui/button";
import type { BookingJourneyState } from "@/features/bookings/journey";
import type { BookingStatus } from "@/features/bookings/status";
import type { BookingActionState } from "@/features/bookings/action-state";
import { cn } from "@/lib/utils/cn";

type BookingJourneyProps = {
  journey: BookingJourneyState;
  transitionAction: (toStatus: BookingStatus, formData: FormData) => Promise<void>;
  completionAction: (
    previousState: BookingActionState,
    formData: FormData,
  ) => Promise<BookingActionState>;
  canCancel: boolean;
  cancellationReasonRequired: boolean;
  canReschedule: boolean;
  canAmend: boolean;
  canAdd: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Time not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const stateLabels = {
  completed: "Completed",
  current: "Current",
  upcoming: "Upcoming",
  attention: "Waiting",
  cancelled: "Cancelled",
} as const;

function StageIcon({ state }: { state: keyof typeof stateLabels }) {
  if (state === "completed") return <Check className="size-4" aria-hidden="true" />;
  if (state === "attention") return <Clock3 className="size-4" aria-hidden="true" />;
  if (state === "cancelled") return <X className="size-4" aria-hidden="true" />;
  return <Circle className="size-3" fill="currentColor" aria-hidden="true" />;
}

export function BookingJourney({
  journey,
  transitionAction,
  completionAction,
  canCancel,
  cancellationReasonRequired,
  canReschedule,
  canAmend,
  canAdd,
  cancelledAt,
  cancellationReason,
}: BookingJourneyProps) {
  const hasOtherActions = canCancel || canReschedule || canAmend || canAdd;

  return (
    <section
      aria-labelledby="booking-journey-title"
      className="border-y border-border py-4 sm:py-6"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="text-[0.6875rem] font-medium uppercase text-muted-foreground sm:text-xs">
            Booking journey
          </p>
          <h2
            id="booking-journey-title"
            className="mt-1 break-words text-xl font-semibold"
          >
            {journey.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {journey.description}
          </p>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-1">
          <div className="rounded-lg border border-primary/15 bg-primary/[0.045] p-4 sm:p-5">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {journey.complete ? "Journey status" : "What to do next"}
            </p>

            {journey.primaryAction ? (
              <>
                <p className="mt-2 text-sm leading-6">
                  {journey.primaryAction.description}
                </p>
                <div className="mt-4">
                  {journey.primaryAction.kind === "transition" &&
                  journey.primaryAction.toStatus === "COMPLETED" ? (
                    <BookingCompletionDialog action={completionAction} />
                  ) : journey.primaryAction.kind === "transition" ? (
                    <BookingStatusForm
                      action={transitionAction.bind(null, journey.primaryAction.toStatus)}
                      label={journey.primaryAction.label}
                      pendingLabel={journey.primaryAction.pendingLabel}
                      variant="primary"
                    />
                  ) : (
                    <Button asChild className="w-full sm:w-fit">
                      <a
                        href={journey.primaryAction.href}
                        style={{ color: "var(--primary-foreground)" }}
                      >
                        {journey.primaryAction.label}
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {journey.status === "CANCELLED"
                  ? "No further fulfilment actions are available."
                  : "No further action is required for this journey."}
              </p>
            )}

            {journey.waitingReason ? (
              <p className="mt-4 border-l-2 border-accent pl-3 text-sm leading-6 text-muted-foreground">
                {journey.waitingReason}
              </p>
            ) : null}

            {journey.status === "CANCELLED" ? (
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p>Cancelled {formatDateTime(cancelledAt)}</p>
                {cancellationReason ? (
                  <p className="break-words">Reason: {cancellationReason}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {journey.attention.length > 0 ? (
            <div className="mt-4 space-y-3" aria-label="Booking attention items">
              {journey.attention.map((item) => (
                <div
                  key={item.kind}
                  className="rounded-md border border-accent/40 bg-accent/5 p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-6">{item.message}</p>
                      <a
                        href={item.href}
                        className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {item.actionLabel}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {hasOtherActions ? (
            <details className="mt-4 rounded-md border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Other actions
              </summary>
              <div className="mt-3 flex flex-col items-start gap-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {canReschedule ? (
                    <a href="#reschedule" className="text-primary hover:underline">
                      Reschedule
                    </a>
                  ) : null}
                  {canAmend ? (
                    <a href="#booking-changes" className="text-primary hover:underline">
                      Propose changes
                    </a>
                  ) : null}
                  {canAdd ? (
                    <a href="#booking-addons" className="text-primary hover:underline">
                      Add to booking
                    </a>
                  ) : null}
                </div>
                {canCancel ? (
                  <BookingStatusForm
                    action={transitionAction.bind(null, "CANCELLED")}
                    label="Cancel booking"
                    pendingLabel="Cancelling booking..."
                    variant="destructive"
                    confirmation={{
                      title: "Cancel this booking?",
                      description:
                        "This will cancel the booking and stop the current fulfilment journey.",
                      confirmLabel: "Cancel booking",
                    }}
                    cancellationReason
                    cancellationReasonRequired={cancellationReasonRequired}
                  />
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <ol className="rounded-lg border border-border bg-card p-4 lg:col-start-1 lg:row-start-2" aria-label="Booking progress">
          {journey.stages.map((stage, index) => {
            const isCurrent = stage.state === "current" || stage.state === "attention";
            return (
              <li
                key={stage.key}
                className="relative flex min-h-[3.25rem] gap-3 pb-2.5 last:min-h-0 last:pb-0"
                aria-current={isCurrent ? "step" : undefined}
              >
                {index < journey.stages.length - 1 ? (
                  <span
                    className={cn(
                      "absolute left-[13px] top-7 h-[calc(100%-0.75rem)] w-px",
                      stage.state === "completed" ? "bg-primary/45" : "bg-border",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border",
                    stage.state === "completed" &&
                      "border-primary bg-primary text-primary-foreground",
                    stage.state === "current" &&
                      "border-primary bg-card text-primary ring-2 ring-primary/15",
                    stage.state === "upcoming" &&
                      "border-border bg-card text-muted-foreground",
                    stage.state === "attention" &&
                      "border-accent bg-accent/10 text-accent",
                    stage.state === "cancelled" &&
                      "border-destructive bg-destructive text-white",
                  )}
                >
                  <StageIcon state={stage.state} />
                </span>
                <span className="min-w-0 pt-1">
                  <span
                    className={cn(
                      "block break-words text-sm font-medium",
                      stage.state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {stateLabels[stage.state]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
