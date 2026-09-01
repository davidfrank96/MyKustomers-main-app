"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarClock,
  CalendarDays,
  Info,
  LoaderCircle,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialBookingActionState,
  type BookingActionState,
} from "@/features/bookings/action-state";

type BookingRescheduleFormProps = {
  action: (
    previousState: BookingActionState,
    formData: FormData,
  ) => Promise<BookingActionState>;
  currentScheduledFor: string | null;
  disabled?: boolean;
  reconfirmationExpected?: boolean;
};

function toLocalDateTimeValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      className="h-11 w-full sm:h-12"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <CalendarClock className="size-4" aria-hidden="true" />
      )}
      {pending ? "Rescheduling..." : "Reschedule"}
    </Button>
  );
}

export function BookingRescheduleForm({
  action,
  currentScheduledFor,
  disabled = false,
  reconfirmationExpected = false,
}: BookingRescheduleFormProps) {
  const [state, formAction] = useActionState(action, initialBookingActionState);
  const [scheduledLocal, setScheduledLocal] = useState(
    toLocalDateTimeValue(currentScheduledFor),
  );
  const scheduledForIso = useMemo(() => {
    if (!scheduledLocal) {
      return "";
    }

    const date = new Date(scheduledLocal);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [scheduledLocal]);
  const scheduledError = state.fieldErrors?.scheduledFor?.[0];
  const helperId = "reschedule-date-helper";
  const errorId = "reschedule-error";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div
        role="note"
        className="flex items-start gap-3 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-3 text-sm leading-5 text-foreground"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <p className="self-center">Choose a new date and time for this booking.</p>
      </div>

      {state.message ? (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm leading-5 text-muted-foreground"
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="scheduledFor" value={scheduledForIso} />
      <div className="space-y-2">
        <Label htmlFor="rescheduledForLocal" className="text-sm font-semibold">
          New scheduled date
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-px left-px z-10 grid w-10 place-items-center rounded-l-md bg-primary/[0.05] text-primary">
            <CalendarDays className="size-[1.125rem]" aria-hidden="true" />
          </span>
          <Input
            id="rescheduledForLocal"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(event) => setScheduledLocal(event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(scheduledError)}
            aria-describedby={scheduledError ? `${helperId} ${errorId}` : helperId}
            className="h-11 pl-12 pr-2 text-base outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-12 sm:text-sm"
          />
        </div>
        <p id={helperId} className="text-sm leading-5 text-muted-foreground">
          Select the new date and time for this booking.
        </p>
        {scheduledError ? (
          <p id={errorId} className="text-sm leading-5 text-destructive">
            {scheduledError}
          </p>
        ) : null}
      </div>

      <SubmitButton disabled={disabled} />

      <div
        role="note"
        className="flex items-start gap-3 rounded-md border border-border bg-muted/45 px-3 py-3 text-sm leading-5 text-muted-foreground"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
          <MailCheck className="size-4" aria-hidden="true" />
        </span>
        <p className="self-center">
          {reconfirmationExpected
            ? "The customer will need to confirm the updated schedule. Email delivery is attempted using the saved confirmation address."
            : "A reschedule email is sent only after a customer has previously confirmed the booking."}
        </p>
      </div>
    </form>
  );
}
