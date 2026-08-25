"use client";

import { useActionState, useState } from "react";
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
import {
  initialBookingActionState,
  type BookingActionState,
} from "@/features/bookings/action-state";

type BookingCompletionDialogProps = {
  action: (
    previousState: BookingActionState,
    formData: FormData,
  ) => Promise<BookingActionState>;
};

export function BookingCompletionDialog({ action }: BookingCompletionDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialBookingActionState);

  return (
    <Dialog
      open={state.status === "success" ? false : open}
      onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}
    >
      <DialogTrigger asChild>
        <Button type="button" className="w-full sm:w-fit">
          Complete booking
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete this booking?</DialogTitle>
          <DialogDescription>
            This will mark the booking as completed and move it to the feedback stage.
          </DialogDescription>
        </DialogHeader>

        {state.status === "error" && state.message ? (
          <p
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}

        <form
          action={formAction}
          className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        >
          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="w-full sm:w-fit"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending} className="w-full sm:w-fit">
            {pending ? "Completing booking…" : "Complete booking"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
