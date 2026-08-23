"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Plus, Save, Search, UserRound } from "lucide-react";
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
  defaultCustomerMode?: "existing" | "new";
  disabled?: boolean;
  scheduledDisabled?: boolean;
  materialDisabled?: boolean;
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
  defaultCustomerMode = "existing",
  disabled = false,
  scheduledDisabled = false,
  materialDisabled = false,
}: BookingFormProps) {
  const [state, formAction] = useActionState(action, initialBookingActionState);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    defaultCustomerMode,
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialValues.customerId ?? "",
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [title, setTitle] = useState(initialValues.title ?? "");
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [currency, setCurrency] = useState(initialValues.currency ?? "NGN");
  const [totalAmount, setTotalAmount] = useState(initialValues.totalAmount ?? "");
  const [depositAmount, setDepositAmount] = useState(
    initialValues.depositAmount ?? "0.00",
  );
  const [internalNotes, setInternalNotes] = useState(initialValues.internalNotes ?? "");
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
  const customerOptions = useMemo(() => {
    const options = [...customers];

    for (const candidate of state.duplicateCandidates ?? []) {
      if (!options.some((customer) => customer.id === candidate.id)) {
        options.push(candidate);
      }
    }

    return options;
  }, [customers, state.duplicateCandidates]);
  const filteredCustomers = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return customerOptions;
    }

    return customerOptions.filter((customer) =>
      [customer.name, customer.email, customer.phone].some((value) =>
        value?.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [customerOptions, customerSearch]);
  const duplicateWarningActive = Boolean(
    state.duplicateCandidates?.length &&
    state.duplicateInput &&
    state.duplicateInput.name === newCustomerName.trim() &&
    state.duplicateInput.email === (newCustomerEmail.trim().toLowerCase() || null) &&
    state.duplicateInput.phone === (newCustomerPhone.trim() || null),
  );

  function chooseCustomerMode(nextMode: "existing" | "new") {
    setCustomerMode(nextMode);

    if (nextMode === "existing") {
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
    } else {
      setSelectedCustomerId("");
      setCustomerSearch("");
    }
  }

  function selectExistingCustomer(customer: CustomerOption) {
    setCustomerMode("existing");
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name);
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
  }

  return (
    <form action={formAction} className="min-w-0 space-y-5" noValidate>
      {state.message ? (
        <div
          className="flex gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.status === "error" ? (
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
          )}
          <span className="text-muted-foreground">{state.message}</span>
        </div>
      ) : null}

      {!materialDisabled ? (
        <input type="hidden" name="scheduledFor" value={scheduledForIso} />
      ) : null}
      {mode === "create" ? (
        <input type="hidden" name="customerMode" value={customerMode} />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {mode === "create" ? (
          <div className="min-w-0 space-y-4 md:col-span-2">
            <div>
              <Label>Customer</Label>
              <div
                className="mt-2 grid w-full gap-1 rounded-md border border-border bg-muted p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"
                role="group"
                aria-label="Customer selection mode"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={customerMode === "existing" ? "primary" : "ghost"}
                  aria-pressed={customerMode === "existing"}
                  disabled={disabled || customers.length === 0}
                  className="w-full sm:w-auto"
                  onClick={() => chooseCustomerMode("existing")}
                >
                  <UserRound className="size-4" aria-hidden="true" />
                  Existing customer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={customerMode === "new" ? "primary" : "ghost"}
                  aria-pressed={customerMode === "new"}
                  disabled={disabled}
                  className="w-full sm:w-auto"
                  onClick={() => chooseCustomerMode("new")}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add new customer
                </Button>
              </div>
            </div>

            {customerMode === "existing" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="customerSearch">Search existing customers</Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="customerSearch"
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Name, email, or phone"
                      className="pl-9"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerId">Customer</Label>
                  <Select
                    name="customerId"
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id="customerId"
                      aria-invalid={Boolean(fieldError(state, "customerId"))}
                    >
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                          {customer.phone ? ` - ${customer.phone}` : ""}
                          {!customer.phone && customer.email
                            ? ` - ${customer.email}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      No active customers match this search.
                    </p>
                  ) : null}
                  {fieldError(state, "customerId") ? (
                    <p className="text-sm leading-5 text-destructive">
                      {fieldError(state, "customerId")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="newCustomerName">Customer name</Label>
                  <Input
                    id="newCustomerName"
                    name="newCustomerName"
                    value={newCustomerName}
                    onChange={(event) => setNewCustomerName(event.target.value)}
                    required
                    disabled={disabled}
                    aria-invalid={Boolean(fieldError(state, "newCustomerName"))}
                  />
                  {fieldError(state, "newCustomerName") ? (
                    <p className="text-sm leading-5 text-destructive">
                      {fieldError(state, "newCustomerName")}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newCustomerEmail">Email</Label>
                  <Input
                    id="newCustomerEmail"
                    name="newCustomerEmail"
                    type="email"
                    autoComplete="email"
                    value={newCustomerEmail}
                    onChange={(event) => setNewCustomerEmail(event.target.value)}
                    disabled={disabled}
                    aria-invalid={Boolean(fieldError(state, "newCustomerEmail"))}
                  />
                  {fieldError(state, "newCustomerEmail") ? (
                    <p className="text-sm leading-5 text-destructive">
                      {fieldError(state, "newCustomerEmail")}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newCustomerPhone">Phone</Label>
                  <Input
                    id="newCustomerPhone"
                    name="newCustomerPhone"
                    type="tel"
                    autoComplete="tel"
                    value={newCustomerPhone}
                    onChange={(event) => setNewCustomerPhone(event.target.value)}
                    disabled={disabled}
                    aria-invalid={Boolean(fieldError(state, "newCustomerPhone"))}
                  />
                  {fieldError(state, "newCustomerPhone") ? (
                    <p className="text-sm leading-5 text-destructive">
                      {fieldError(state, "newCustomerPhone")}
                    </p>
                  ) : null}
                </div>

                {duplicateWarningActive ? (
                  <div className="space-y-3 rounded-md border border-border bg-muted p-3 sm:col-span-2">
                    <div>
                      <p className="text-sm font-medium">Possible existing customer</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        An active customer has the same name, email, or phone.
                      </p>
                    </div>
                    {(state.duplicateCandidates ?? []).map((customer) => (
                      <div
                        key={customer.id}
                        className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="break-words text-xs text-muted-foreground">
                            {[customer.email, customer.phone]
                              .filter(Boolean)
                              .join(" / ") || "No contact details"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label={`Use ${customer.name}`}
                          className="w-full sm:w-auto"
                          onClick={() => selectExistingCustomer(customer)}
                        >
                          Use existing customer
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Booking title</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            disabled={disabled || materialDisabled}
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
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            disabled={disabled || materialDisabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            name="currency"
            value={currency}
            onValueChange={setCurrency}
            disabled={disabled || materialDisabled}
          >
            <SelectTrigger
              id="currency"
              aria-invalid={Boolean(fieldError(state, "currency"))}
            >
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
            disabled={disabled || scheduledDisabled || materialDisabled}
            aria-invalid={Boolean(fieldError(state, "scheduledFor"))}
            aria-describedby={
              fieldError(state, "scheduledFor") ? "scheduled-error" : undefined
            }
          />
          {scheduledDisabled ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Use reschedule to change this date after customer confirmation starts.
            </p>
          ) : null}
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
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            required
            disabled={disabled || materialDisabled}
            aria-invalid={Boolean(fieldError(state, "totalAmount"))}
            aria-describedby={
              fieldError(state, "totalAmount") ? "total-error" : undefined
            }
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
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            required
            disabled={disabled || materialDisabled}
            aria-invalid={Boolean(fieldError(state, "depositAmount"))}
            aria-describedby={
              fieldError(state, "depositAmount") ? "deposit-error" : undefined
            }
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
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            maxLength={5000}
            disabled={disabled}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Only visible to your business.
          </p>
        </div>
      </div>

      {!disabled ? (
        mode === "create" && customerMode === "new" && duplicateWarningActive ? (
          <Button type="submit" name="duplicateAcknowledged" value="true">
            <Save className="size-4" aria-hidden="true" />
            Continue with new customer
          </Button>
        ) : (
          <SubmitButton label={submitLabel} />
        )
      ) : null}
    </form>
  );
}
