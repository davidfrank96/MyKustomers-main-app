"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  archiveCustomerLifecycleAction,
  deleteCustomerAction,
  restoreCustomerAction,
} from "@/features/customers/actions";
import { initialCustomerActionState } from "@/features/customers/action-state";

function LifecycleButton({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className="w-full sm:w-auto"
    >
      {pending ? "Working…" : children}
    </Button>
  );
}

export function CustomerLifecyclePanel({
  customerId,
  customerName,
  isArchived,
  hasBookings,
  hasActiveBookings,
  canDelete,
}: {
  customerId: string;
  customerName: string;
  isArchived: boolean;
  hasBookings: boolean;
  hasActiveBookings: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveState, archiveAction] = useActionState(
    archiveCustomerLifecycleAction.bind(null, customerId),
    initialCustomerActionState,
  );
  const [restoreState, restoreAction] = useActionState(
    restoreCustomerAction.bind(null, customerId),
    initialCustomerActionState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteCustomerAction.bind(null, customerId),
    initialCustomerActionState,
  );

  useEffect(() => {
    if (archiveState.status === "success" || deleteState.status === "success") {
      router.replace("/customers");
    }
  }, [archiveState.status, deleteState.status, router]);

  const message = deleteState.message ?? archiveState.message ?? restoreState.message;
  const messageIsError =
    deleteState.status === "error" ||
    archiveState.status === "error" ||
    restoreState.status === "error";

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-labelledby="customer-actions-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="customer-actions-title" className="font-semibold">
            Customer actions
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Archive is the everyday removal option. It preserves this profile and every
            booking.
          </p>
          {hasActiveBookings ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Active bookings remain active if this customer is archived.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <form action={isArchived ? restoreAction : archiveAction}>
            <LifecycleButton>
              {isArchived ? (
                <RotateCcw className="size-4" aria-hidden="true" />
              ) : (
                <Archive className="size-4" aria-hidden="true" />
              )}
              {isArchived ? "Restore customer" : "Archive customer"}
            </LifecycleButton>
          </form>
          {canDelete && !hasBookings ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" /> Delete customer
            </Button>
          ) : null}
        </div>
      </div>

      {canDelete && hasBookings ? (
        <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          This customer has booking history and can’t be permanently deleted. Archive them
          instead.
        </div>
      ) : null}
      {message ? (
        <p
          className={`mt-4 text-sm ${messageIsError ? "text-destructive" : "text-muted-foreground"}`}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer?</DialogTitle>
            <DialogDescription>
              This permanently deletes {customerName}&apos;s customer profile. Bookings
              are never deleted through this action.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <form action={deleteAction}>
              <LifecycleButton variant="destructive">Delete customer</LifecycleButton>
            </form>
          </div>
          {deleteState.status === "error" ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {deleteState.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
