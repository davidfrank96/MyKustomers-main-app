"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  initialBookingActionState,
  type BookingActionState,
} from "@/features/bookings/action-state";
import { bookingCurrencies } from "@/features/bookings/money";

type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type BookingFormValues = {
  customerId?: string;
  title?: string;
  description?: string | null;
  currency?: string;
  totalAmount?: string;
  depositAmount?: string;
  scheduledFor?: string | null;
  internalNotes?: string | null;
};

type BookingFormProps = {
  action: (
    previousState: BookingActionState,
    formData: FormData,
  ) => Promise<BookingActionState>;
  submitLabel: string;
  customers?: CustomerOption[];
  initialValues?: BookingFormValues;
  mode: "create" | "edit";
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

function fieldError(state: BookingActionState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Please wait..." : label}
    </Button>
  );
}

export function BookingForm({
  action,
  submitLabel,
  customers = [],
  initialValues = {},
  mode,
  disabled = false,
}: BookingFormProps) {
  const [state, formAction] = useActionState(action, initialBookingActionState);
  const [scheduledLocal, setScheduledLocal] = useState(
    toLocalDateTimeValue(initialValues.scheduledFor),
  );
  const scheduledForIso = useMemo(() => {
    if (!scheduledLocal) {
      return "";
    }

    const date = new Date(scheduledLocal);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [scheduledLocal]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <div
          className="flex gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.status === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span className="text-muted-foreground">{state.message}</span>
        </div>
      ) : null}

      <input type="hidden" name="scheduledFor" value={scheduledForIso} />

      <div className="grid gap-4 md:grid-cols-2">
        {mode === "create" ? (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="customerId">Customer</Label>
            <Select
              name="customerId"
              defaultValue={initialValues.customerId ?? ""}
              disabled={disabled}
            >
              <SelectTrigger
                id="customerId"
                aria-invalid={Boolean(fieldError(state, "customerId"))}
              >
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                    {!customer.phone && customer.email ? ` - ${customer.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError(state, "customerId") ? (
              <p className="text-sm leading-5 text-destructive">
                {fieldError(state, "customerId")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Booking title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={initialValues.title ?? ""}
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "title"))}
            aria-describedby={fieldError(state, "title") ? "title-error" : undefined}
          />
          {fieldError(state, "title") ? (
            <p id="title-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "title")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={initialValues.description ?? ""}
            maxLength={5000}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            name="currency"
            defaultValue={initialValues.currency ?? "NGN"}
            disabled={disabled}
          >
            <SelectTrigger id="currency" aria-invalid={Boolean(fieldError(state, "currency"))}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bookingCurrencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError(state, "currency") ? (
            <p className="text-sm leading-5 text-destructive">
              {fieldError(state, "currency")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduledForLocal">Scheduled date</Label>
          <Input
            id="scheduledForLocal"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(event) => setScheduledLocal(event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "scheduledFor"))}
            aria-describedby={fieldError(state, "scheduledFor") ? "scheduled-error" : undefined}
          />
          {fieldError(state, "scheduledFor") ? (
            <p id="scheduled-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "scheduledFor")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAmount">Agreed total</Label>
          <Input
            id="totalAmount"
            name="totalAmount"
            inputMode="decimal"
            defaultValue={initialValues.totalAmount ?? ""}
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "totalAmount"))}
            aria-describedby={fieldError(state, "totalAmount") ? "total-error" : undefined}
          />
          {fieldError(state, "totalAmount") ? (
            <p id="total-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "totalAmount")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="depositAmount">Deposit recorded</Label>
          <Input
            id="depositAmount"
            name="depositAmount"
            inputMode="decimal"
            defaultValue={initialValues.depositAmount ?? "0.00"}
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "depositAmount"))}
            aria-describedby={fieldError(state, "depositAmount") ? "deposit-error" : undefined}
          />
          {fieldError(state, "depositAmount") ? (
            <p id="deposit-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "depositAmount")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="internalNotes">Internal notes</Label>
          <Textarea
            id="internalNotes"
            name="internalNotes"
            defaultValue={initialValues.internalNotes ?? ""}
            maxLength={5000}
            disabled={disabled}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Only visible to your business.
          </p>
        </div>
      </div>

      {!disabled ? <SubmitButton label={submitLabel} /> : null}
    </form>
  );
}
