"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BookingStatusFormProps = {
  action: (formData: FormData) => Promise<void>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
  confirmation?: {
    title: string;
    description: string;
    confirmLabel: string;
  };
  cancellationReason?: boolean;
  cancellationReasonRequired?: boolean;
  fullWidth?: boolean;
};

function SubmitButton({
  label,
  pendingLabel,
  variant,
  fullWidth,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary" | "destructive";
  fullWidth: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={fullWidth ? "md" : "sm"}
      className={fullWidth ? "w-full" : "w-full sm:w-fit"}
      disabled={pending}
      aria-live="polite"
    >
      {pending ? (
        <span className="animate-spin" aria-hidden="true">
          <LoaderCircle className="size-4" />
        </span>
      ) : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function BookingStatusForm({
  action,
  label,
  pendingLabel = "Please wait...",
  variant = "secondary",
  confirmation,
  cancellationReason = false,
  cancellationReasonRequired = false,
  fullWidth = false,
}: BookingStatusFormProps) {
  const form = (
    <form
      action={action}
      className={cancellationReason ? "flex w-full flex-col gap-2" : undefined}
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
      <SubmitButton
        label={label}
        pendingLabel={pendingLabel}
        variant={variant}
        fullWidth={fullWidth}
      />
    </form>
  );

  if (!confirmation) {
    return form;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={fullWidth ? "md" : "sm"}
          className={fullWidth ? "w-full" : "w-full sm:w-fit"}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmation.title}</DialogTitle>
          <DialogDescription>{confirmation.description}</DialogDescription>
        </DialogHeader>
        <div className="mt-5">
          {cancellationReason ? (
            <form action={action} className="space-y-4">
              <input
                name="cancellationReason"
                className="min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                maxLength={500}
                placeholder={
                  cancellationReasonRequired ? "Cancellation reason" : "Optional reason"
                }
                aria-label="Cancellation reason"
                required={cancellationReasonRequired}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-fit">
                    Keep booking
                  </Button>
                </DialogClose>
                <SubmitButton
                  label={confirmation.confirmLabel}
                  pendingLabel={pendingLabel}
                  variant={variant}
                  fullWidth={false}
                />
              </div>
            </form>
          ) : (
            form
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
