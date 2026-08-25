"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type BookingStatusFormProps = {
  action: (formData: FormData) => Promise<void>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
  confirmMessage?: string;
  cancellationReason?: boolean;
  cancellationReasonRequired?: boolean;
};

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      className="w-full sm:w-fit"
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function BookingStatusForm({
  action,
  label,
  pendingLabel = "Please wait...",
  variant = "secondary",
  confirmMessage,
  cancellationReason = false,
  cancellationReasonRequired = false,
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
          placeholder={
            cancellationReasonRequired ? "Cancellation reason" : "Optional reason"
          }
          aria-label="Cancellation reason"
          required={cancellationReasonRequired}
        />
      ) : null}
      <SubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
