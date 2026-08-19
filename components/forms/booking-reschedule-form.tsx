"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock } from "lucide-react";
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
    <Button type="submit" variant="secondary" disabled={disabled || pending}>
      <CalendarClock className="size-4" aria-hidden="true" />
      {pending ? "Rescheduling..." : "Reschedule"}
    </Button>
  );
}

export function BookingRescheduleForm({
  action,
  currentScheduledFor,
  disabled = false,
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

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="scheduledFor" value={scheduledForIso} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="rescheduledForLocal">New scheduled date</Label>
          <Input
            id="rescheduledForLocal"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(event) => setScheduledLocal(event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(scheduledError)}
            aria-describedby={scheduledError ? "reschedule-error" : undefined}
          />
          {scheduledError ? (
            <p id="reschedule-error" className="text-sm leading-5 text-destructive">
              {scheduledError}
            </p>
          ) : null}
        </div>
        <SubmitButton disabled={disabled} />
      </div>
    </form>
  );
}
