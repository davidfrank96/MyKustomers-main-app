"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useCallback, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, ChevronRight, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveCustomerLifecycleAction,
  deleteCustomerAction,
  restoreCustomerAction,
} from "@/features/customers/actions";
import { initialCustomerActionState } from "@/features/customers/action-state";
import type { CustomerListItem } from "@/features/customers/queries";

type LifecycleOperation = "archive" | "restore" | "delete";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function ActionSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2 disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function CustomerRow({
  customer,
  canDelete,
  onLifecycle,
}: {
  customer: CustomerListItem;
  canDelete: boolean;
  onLifecycle: (customerId: string, operation: LifecycleOperation) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const gesture = useRef<{
    x: number;
    y: number;
    active: boolean;
    offset: number;
  } | null>(null);
  const runArchive = useCallback(
    async (...args: Parameters<typeof archiveCustomerLifecycleAction>) => {
      const nextState = await archiveCustomerLifecycleAction(...args);
      if (nextState.status === "success") onLifecycle(customer.id, "archive");
      return nextState;
    },
    [customer.id, onLifecycle],
  );
  const runRestore = useCallback(
    async (...args: Parameters<typeof restoreCustomerAction>) => {
      const nextState = await restoreCustomerAction(...args);
      if (nextState.status === "success") onLifecycle(customer.id, "restore");
      return nextState;
    },
    [customer.id, onLifecycle],
  );
  const runDelete = useCallback(
    async (...args: Parameters<typeof deleteCustomerAction>) => {
      const nextState = await deleteCustomerAction(...args);
      if (nextState.status === "success") {
        setDeleteOpen(false);
        onLifecycle(customer.id, "delete");
      }
      return nextState;
    },
    [customer.id, onLifecycle],
  );
  const [archiveState, archiveAction] = useActionState(
    runArchive.bind(null, customer.id),
    initialCustomerActionState,
  );
  const [restoreState, restoreAction] = useActionState(
    runRestore.bind(null, customer.id),
    initialCustomerActionState,
  );
  const [deleteState, deleteAction] = useActionState(
    runDelete.bind(null, customer.id),
    initialCustomerActionState,
  );

  const archived = Boolean(customer.archived_at);
  const eligibleForDelete = canDelete && customer.hasBookings === false;
  const revealWidth = eligibleForDelete ? 176 : 88;
  const contact = customer.phone || customer.email || "No contact saved";
  const initial = customer.name.trim().charAt(0).toUpperCase() || "C";
  const lifecycleMessage =
    deleteState.status === "error"
      ? deleteState.message
      : archiveState.status === "error"
        ? archiveState.message
        : restoreState.status === "error"
          ? restoreState.message
          : "";

  return (
    <div className="relative overflow-hidden bg-card">
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={offset === 0}>
        <form action={archived ? restoreAction : archiveAction} className="w-[88px]">
          <button
            type="submit"
            className="flex h-full w-full flex-col items-center justify-center gap-1 bg-primary/[0.09] px-2 text-xs font-semibold text-primary"
          >
            {archived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
            {archived ? "Restore" : "Archive"}
          </button>
        </form>
        {eligibleForDelete ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex w-[88px] flex-col items-center justify-center gap-1 bg-destructive px-2 text-xs font-semibold text-destructive-foreground"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        ) : null}
      </div>

      <div
        data-customer-row-swipe
        className="relative flex min-w-0 items-center gap-2 bg-card p-4 transition-transform motion-reduce:transition-none sm:px-5"
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        onPointerDown={(event) => {
          if (event.clientX <= 24 || event.pointerType === "mouse") return;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            active: false,
            offset: 0,
          };
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.active && (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy) + 6))
            return;
          start.active = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          start.offset = Math.max(-revealWidth, Math.min(0, dx));
          setOffset(start.offset);
        }}
        onPointerUp={() => {
          if (!gesture.current) return;
          setOffset(gesture.current.offset < -44 ? -revealWidth : 0);
          gesture.current = null;
        }}
        onPointerCancel={() => {
          setOffset(0);
          gesture.current = null;
        }}
      >
        <Link
          href={`/customers/${customer.id}` as Route}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-primary">
            {initial}
          </span>
          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold leading-5 sm:text-base">
                  {customer.name}
                </h2>
                {archived ? <Badge variant="outline">Archived</Badge> : null}
              </div>
              <p className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                {contact}
              </p>
            </div>
            <p className="mt-1 shrink-0 text-xs text-muted-foreground sm:mt-0 sm:text-sm">
              Customer since {formatDate(customer.created_at)}
            </p>
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${customer.name}`}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <form action={archived ? restoreAction : archiveAction}>
                <ActionSubmit
                  label={archived ? "Restore customer" : "Archive customer"}
                />
              </form>
            </DropdownMenuItem>
            {eligibleForDelete ? (
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" /> Delete customer
              </DropdownMenuItem>
            ) : null}
            {canDelete && customer.hasBookings ? (
              <DropdownMenuItem disabled>
                Delete unavailable — booking history
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {lifecycleMessage ? (
        <p className="px-4 pb-3 text-sm text-destructive" role="alert">
          {lifecycleMessage}
        </p>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer?</DialogTitle>
            <DialogDescription>
              This permanently deletes {customer.name}&apos;s customer profile. Bookings
              are never deleted through this action.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <form action={deleteAction}>
              <Button type="submit" variant="destructive" className="w-full">
                Delete customer
              </Button>
            </form>
          </div>
          {deleteState.status === "error" ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {deleteState.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
