"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Info,
  LoaderCircle,
  NotebookPen,
  Plus,
  Save,
  Search,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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

function SubmitButton({
  label,
  fullWidth = false,
}: {
  label: string;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={fullWidth ? "h-12 w-full" : "w-full sm:w-fit"}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Save className="size-4" aria-hidden="true" />
      )}
      {pending ? "Please wait..." : label}
    </Button>
  );
}

function DuplicateCustomerSubmitButton({ fullWidth }: { fullWidth: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      name="duplicateAcknowledged"
      value="true"
      disabled={pending}
      className={fullWidth ? "h-12 w-full" : undefined}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Save className="size-4" aria-hidden="true" />
      )}
      {pending ? "Please wait..." : "Continue with new customer"}
    </Button>
  );
}

function CreateFormSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary"
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <h2 className="text-base font-semibold leading-6">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:px-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function formatSummaryDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
  const [depositAmount, setDepositAmount] = useState(initialValues.depositAmount ?? "");
  const [internalNotes, setInternalNotes] = useState(initialValues.internalNotes ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(
    toLocalDateTimeValue(initialValues.scheduledFor),
  );
  const debouncedCustomerSearch = useDebouncedValue(customerSearch);
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
    const normalizedSearch = debouncedCustomerSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return customerOptions;
    }

    return customerOptions.filter((customer) =>
      [customer.name, customer.email, customer.phone].some((value) =>
        value?.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [customerOptions, debouncedCustomerSearch]);
  const matchingCustomerSuggestions = debouncedCustomerSearch.trim()
    ? filteredCustomers.slice(0, 8)
    : [];
  const customerSearchPending = customerSearch !== debouncedCustomerSearch;
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

  const selectedCustomerName =
    customerMode === "existing"
      ? (customerOptions.find((customer) => customer.id === selectedCustomerId)?.name ??
        "")
      : newCustomerName.trim();

  const customerFields = (
    <div className="min-w-0 space-y-5">
      <div>
        <Label>Customer</Label>
        <div
          className="mt-2 grid w-full gap-1 rounded-md border border-border bg-muted p-1 sm:grid-cols-2"
          role="group"
          aria-label="Customer selection mode"
        >
          <Button
            type="button"
            variant={customerMode === "existing" ? "primary" : "secondary"}
            aria-pressed={customerMode === "existing"}
            aria-label="Use existing customer"
            disabled={disabled || customers.length === 0}
            className="h-11 w-full"
            onClick={() => chooseCustomerMode("existing")}
          >
            <UserRound className="size-4" aria-hidden="true" />
            Existing customer
          </Button>
          <Button
            type="button"
            variant={customerMode === "new" ? "primary" : "secondary"}
            aria-pressed={customerMode === "new"}
            aria-label="Add new customer"
            disabled={disabled}
            className="h-11 w-full"
            onClick={() => chooseCustomerMode("new")}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add new customer
          </Button>
        </div>
      </div>

      {customerMode === "existing" ? (
        <div className="space-y-4">
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
                className={
                  customerSearch || customerSearchPending ? "pl-9 pr-20" : "pl-9 pr-3"
                }
                disabled={disabled}
                role="combobox"
                aria-autocomplete="list"
                aria-controls="customer-search-results"
                aria-expanded={Boolean(debouncedCustomerSearch.trim())}
                aria-busy={customerSearchPending}
              />
              {customerSearchPending ? (
                <LoaderCircle
                  className="absolute right-11 top-3.5 size-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              {customerSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-0.5 size-10"
                  onClick={() => setCustomerSearch("")}
                  aria-label="Clear existing customer search"
                  title="Clear existing customer search"
                  disabled={disabled}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <span className="sr-only" role="status" aria-live="polite">
              {customerSearchPending ? "Searching customers..." : ""}
            </span>
          </div>

          {debouncedCustomerSearch.trim() && matchingCustomerSuggestions.length > 0 ? (
            <div
              id="customer-search-results"
              role="listbox"
              aria-label="Matching active customers"
              className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-border bg-card p-1"
            >
              {matchingCustomerSuggestions.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={selectedCustomerId === customer.id}
                  className="min-w-0 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => selectExistingCustomer(customer)}
                >
                  <span className="block break-words font-medium">{customer.name}</span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {[customer.email, customer.phone].filter(Boolean).join(" / ") ||
                      "No contact details"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {debouncedCustomerSearch.trim() && matchingCustomerSuggestions.length === 0 ? (
            <p
              id="customer-search-results"
              className="rounded-md border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground"
              role="status"
            >
              No active customers match this search.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label
              htmlFor="customerId"
              className="after:ml-0.5 after:text-destructive after:content-['*']"
            >
              Customer
            </Label>
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
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label
              htmlFor="newCustomerName"
              className="after:ml-0.5 after:text-destructive after:content-['*']"
            >
              Customer name
            </Label>
            <Input
              id="newCustomerName"
              name="newCustomerName"
              value={newCustomerName}
              onChange={(event) => setNewCustomerName(event.target.value)}
              placeholder="Enter customer name"
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
            <Label htmlFor="newCustomerEmail">Email (optional)</Label>
            <Input
              id="newCustomerEmail"
              name="newCustomerEmail"
              type="email"
              autoComplete="email"
              value={newCustomerEmail}
              onChange={(event) => setNewCustomerEmail(event.target.value)}
              placeholder="Enter email if available"
              disabled={disabled}
              aria-invalid={Boolean(fieldError(state, "newCustomerEmail"))}
            />
            {fieldError(state, "newCustomerEmail") ? (
              <p className="text-sm leading-5 text-destructive">
                {fieldError(state, "newCustomerEmail")}
              </p>
            ) : (
              <p className="text-sm leading-5 text-muted-foreground">
                You can add this later if the customer does not have an email available
                now.
              </p>
            )}
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
              placeholder="Phone number"
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
                    <p className="break-words text-sm font-medium">{customer.name}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {[customer.email, customer.phone].filter(Boolean).join(" / ") ||
                        "No contact details"}
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
  );

  const titleField = (
    <div className="space-y-2 md:col-span-2">
      <Label
        htmlFor="title"
        className="after:ml-0.5 after:text-destructive after:content-['*']"
      >
        Booking title
      </Label>
      <Input
        id="title"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={mode === "create" ? "e.g. Website redesign" : undefined}
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
  );

  const descriptionField = (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={mode === "create" ? "Describe the agreed work..." : undefined}
        maxLength={5000}
        disabled={disabled || materialDisabled}
        className={mode === "create" ? "min-h-28" : undefined}
      />
    </div>
  );

  const currencyField = (
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
          {bookingCurrencies.map((currencyOption) => (
            <SelectItem key={currencyOption} value={currencyOption}>
              {currencyOption}
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
  );

  const scheduleField = (
    <div className="space-y-2">
      <Label htmlFor="scheduledForLocal">Scheduled delivery date</Label>
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
  );

  const totalField = (
    <div className="space-y-2">
      <Label
        htmlFor="totalAmount"
        className="after:ml-0.5 after:text-destructive after:content-['*']"
      >
        Agreed total
      </Label>
      <Input
        id="totalAmount"
        name="totalAmount"
        inputMode="decimal"
        value={totalAmount}
        onChange={(event) => setTotalAmount(event.target.value)}
        placeholder="Enter amount"
        required
        disabled={disabled || materialDisabled}
        aria-invalid={Boolean(fieldError(state, "totalAmount"))}
        aria-describedby={fieldError(state, "totalAmount") ? "total-error" : undefined}
      />
      {fieldError(state, "totalAmount") ? (
        <p id="total-error" className="text-sm leading-5 text-destructive">
          {fieldError(state, "totalAmount")}
        </p>
      ) : null}
    </div>
  );

  const depositField = (
    <div className="space-y-2">
      <Label htmlFor="depositAmount">Deposit recorded</Label>
      <Input
        id="depositAmount"
        name="depositAmount"
        inputMode="decimal"
        value={depositAmount}
        onChange={(event) => setDepositAmount(event.target.value)}
        placeholder="Optional"
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
  );

  const notesField = (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="internalNotes">Internal notes</Label>
      <Textarea
        id="internalNotes"
        name="internalNotes"
        value={internalNotes}
        onChange={(event) => setInternalNotes(event.target.value)}
        placeholder={mode === "create" ? "Add any internal notes..." : undefined}
        maxLength={5000}
        disabled={disabled}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Only visible to your business.
      </p>
    </div>
  );

  const submitControl = !disabled ? (
    mode === "create" && customerMode === "new" && duplicateWarningActive ? (
      <DuplicateCustomerSubmitButton fullWidth />
    ) : (
      <SubmitButton label={submitLabel} fullWidth={mode === "create"} />
    )
  ) : null;

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

      {mode === "create" ? (
        <>
          <CreateFormSection title="Booking details" icon={UsersRound}>
            {customerFields}
          </CreateFormSection>

          <CreateFormSection title="Work information" icon={FileText}>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              {titleField}
              {descriptionField}
            </div>
          </CreateFormSection>

          <CreateFormSection title="Schedule & amounts" icon={CalendarDays}>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              {currencyField}
              {scheduleField}
              {totalField}
              {depositField}
            </div>
          </CreateFormSection>

          <CreateFormSection title="Internal notes" icon={NotebookPen}>
            {notesField}
          </CreateFormSection>

          <Card aria-labelledby="booking-summary-title" className="overflow-hidden">
            <div className="flex items-center gap-3 bg-primary/[0.04] px-4 py-4 sm:px-5">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"
                aria-hidden="true"
              >
                <FileText className="size-4" />
              </span>
              <h2 id="booking-summary-title" className="text-base font-semibold">
                Summary
              </h2>
            </div>
            <dl data-booking-summary>
              <SummaryRow label="Customer" value={selectedCustomerName || "—"} />
              <SummaryRow label="Title" value={title.trim() || "—"} />
              <SummaryRow
                label="Delivery date"
                value={formatSummaryDate(scheduledLocal)}
              />
              <SummaryRow
                label="Total amount"
                value={totalAmount.trim() ? `${currency} ${totalAmount.trim()}` : "—"}
              />
              <SummaryRow
                label="Deposit recorded"
                value={depositAmount.trim() ? `${currency} ${depositAmount.trim()}` : "—"}
              />
              <SummaryRow label="Currency" value={currency} />
            </dl>
          </Card>

          <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/[0.04] p-4 text-sm leading-6 text-primary">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              You can update this booking later. Confirmed customer terms continue to
              follow the existing change and reconfirmation rules.
            </p>
          </div>

          {submitControl}
        </>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {titleField}
            {descriptionField}
            {currencyField}
            {scheduleField}
            {totalField}
            {depositField}
            {notesField}
          </div>
          {submitControl}
        </>
      )}
    </form>
  );
}
