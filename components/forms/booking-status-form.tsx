"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type BookingStatusFormProps = {
  action: (formData: FormData) => Promise<void>;
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  confirmMessage?: string;
  cancellationReason?: boolean;
};

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "Please wait..." : label}
    </Button>
  );
}

export function BookingStatusForm({
  action,
  label,
  variant = "secondary",
  confirmMessage,
  cancellationReason = false,
}: BookingStatusFormProps) {
  return (
    <form
      action={action}
      className={cancellationReason ? "flex w-full flex-col gap-2 sm:w-auto" : undefined}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {cancellationReason ? (
        <input
          name="cancellationReason"
          className="min-h-10 rounded-md border border-input bg-card px-3 py-2 text-sm"
          maxLength={500}
          placeholder="Optional cancellation reason"
          aria-label="Cancellation reason"
        />
      ) : null}
      <SubmitButton label={label} variant={variant} />
    </form>
  );
}
