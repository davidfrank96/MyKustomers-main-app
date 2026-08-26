"use client";

import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIVILEGED_REASON_MAX_LENGTH } from "@/lib/admin/privileged-access-policy";

export type PrivilegedActionState = {
  status: "idle" | "error" | "mfa_required" | "success";
  message: string | null;
};

export const initialPrivilegedActionState: PrivilegedActionState = {
  status: "idle",
  message: null,
};

type PrivilegedActionDialogProps = {
  actionTitle: string;
  consequence: string;
  confirmLabel: string;
  triggerLabel: string;
  requiresReason?: boolean;
  action: (
    previousState: PrivilegedActionState,
    formData: FormData,
  ) => Promise<PrivilegedActionState>;
};

export function PrivilegedActionDialog({
  actionTitle,
  consequence,
  confirmLabel,
  triggerLabel,
  requiresReason = false,
  action,
}: PrivilegedActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    action,
    initialPrivilegedActionState,
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <DialogTrigger asChild>
        <Button type="button">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{actionTitle}</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>

        {state.status === "mfa_required" ? (
          <div className="mt-5 border border-border bg-muted p-4" role="alert">
            <p className="text-sm font-medium">Additional verification required.</p>
            <Link
              href="/admin/security"
              className="mt-2 inline-flex text-sm font-medium text-primary"
            >
              Verify in Admin security
            </Link>
          </div>
        ) : null}

        {state.status === "error" && state.message ? (
          <p className="mt-5 text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" ? (
          <div className="mt-5" role="status" aria-live="polite">
            <p className="text-sm font-medium">{state.message ?? "Action completed."}</p>
            <DialogClose asChild>
              <Button type="button" className="mt-4 w-full sm:w-fit">
                Close
              </Button>
            </DialogClose>
          </div>
        ) : (
          <form action={formAction} className="mt-5 space-y-5">
            {requiresReason ? (
              <div>
                <Label htmlFor="privileged-action-reason">Reason</Label>
                <Textarea
                  id="privileged-action-reason"
                  name="reason"
                  className="mt-2"
                  required
                  maxLength={PRIVILEGED_REASON_MAX_LENGTH}
                  aria-describedby="privileged-action-reason-help"
                />
                <p
                  id="privileged-action-reason-help"
                  className="mt-2 text-xs text-muted-foreground"
                >
                  Required for this action. Maximum {PRIVILEGED_REASON_MAX_LENGTH}{" "}
                  characters.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending || state.status === "mfa_required"}>
                {pending ? "Authorizing…" : confirmLabel}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
