"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialBookingActionState,
  type BookingActionState,
} from "@/features/bookings/action-state";
import { formatMoneyMinor, minorUnitsToInput } from "@/features/bookings/money";
import type { BookingPayment, BookingPaymentSummary } from "@/features/bookings/queries";

type BookingPaymentsProps = {
  summary: BookingPaymentSummary | null;
  payments: BookingPayment[];
  canRecordPayment: boolean;
  embedded?: boolean;
  action: (
    previousState: BookingActionState,
    formData: FormData,
  ) => Promise<BookingActionState>;
};

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function PaymentDialog({
  action,
  summary,
}: Pick<BookingPaymentsProps, "action"> & { summary: BookingPaymentSummary }) {
  const [open, setOpen] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [state, formAction, pending] = useActionState(action, initialBookingActionState);

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    if (nextOpen && !operationId) setOperationId(crypto.randomUUID());
    setOpen(nextOpen);
  }

  return (
    <Dialog
      open={state.status === "success" ? false : open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button type="button" className="w-full sm:w-fit">
          <CreditCard className="size-4" aria-hidden="true" />
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Record money already received for this booking. This does not process a
            payment or contact the customer.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="mt-6 space-y-5">
          <input type="hidden" name="operationId" value={operationId} />
          <div className="space-y-2">
            <Label htmlFor="booking-payment-amount">Payment amount</Label>
            <Input
              id="booking-payment-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              max={minorUnitsToInput(summary.outstandingAmountMinor)}
              aria-describedby="booking-payment-balance booking-payment-amount-error"
              aria-invalid={Boolean(state.fieldErrors?.amount)}
              disabled={pending}
              autoFocus
            />
            <p id="booking-payment-balance" className="text-sm text-muted-foreground">
              Outstanding:{" "}
              {formatMoneyMinor(summary.outstandingAmountMinor, summary.currency)}
            </p>
            {state.fieldErrors?.amount?.map((message) => (
              <p
                id="booking-payment-amount-error"
                key={message}
                className="text-sm text-destructive"
              >
                {message}
              </p>
            ))}
          </div>

          {state.status === "error" && state.message ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}

          <p className="sr-only" aria-live="polite">
            {pending ? "Recording payment" : state.message}
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !operationId}>
              {pending ? "Recording payment..." : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BookingPayments({
  summary,
  payments,
  canRecordPayment,
  embedded = false,
  action,
}: BookingPaymentsProps) {
  return (
    <div
      id={embedded ? undefined : "booking-payments"}
      className={embedded ? undefined : "scroll-mt-6 border-y border-border py-5 sm:py-6"}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Payments</p>
          {embedded ? (
            <h3 className="mt-1 text-lg font-semibold">Payment record</h3>
          ) : (
            <h2 className="mt-1 text-lg font-semibold">Payment record</h2>
          )}
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            A record of amounts reported as received. My Kustomers does not process these
            payments.
          </p>
        </div>
        {summary && canRecordPayment && summary.outstandingAmountMinor > 0 ? (
          <PaymentDialog
            key={summary.recordedPaidAmountMinor}
            action={action}
            summary={summary}
          />
        ) : null}
      </div>

      {summary ? (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Effective total</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatMoneyMinor(summary.effectiveTotalAmountMinor, summary.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Recorded as received</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatMoneyMinor(summary.recordedPaidAmountMinor, summary.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Outstanding</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatMoneyMinor(summary.outstandingAmountMinor, summary.currency)}
              </dd>
            </div>
          </dl>

          {summary.outstandingAmountMinor === 0 ? (
            <div className="mt-5 flex items-start gap-2 border-l-2 border-primary pl-3">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">Payment complete</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All agreed payment has been recorded as received.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Payment breakdown</h3>
            <dl className="mt-3 divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <dt>Initial deposit</dt>
                <dd className="font-medium">
                  {formatMoneyMinor(summary.initialDepositAmountMinor, summary.currency)}
                </dd>
              </div>
              {summary.confirmedAddonDepositAmountMinor > 0 ? (
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt>Confirmed add-on deposits</dt>
                  <dd className="font-medium">
                    {formatMoneyMinor(
                      summary.confirmedAddonDepositAmountMinor,
                      summary.currency,
                    )}
                  </dd>
                </div>
              ) : null}
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <dt>Payment recorded {formatPaymentDate(payment.recorded_at)}</dt>
                  <dd className="font-medium">
                    {formatMoneyMinor(payment.amount_minor, summary.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : (
        <p
          className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Payment status is temporarily unavailable. Payment recording and booking
          completion are disabled until it can be verified.
        </p>
      )}
    </div>
  );
}
