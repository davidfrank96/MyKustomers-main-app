"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useState, type ComponentType } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  NotebookPen,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  initialCustomerActionState,
  type CustomerActionState,
} from "@/features/customers/action-state";
import { useFormErrorNavigation } from "@/hooks/use-form-error-navigation";

const customerFieldOrder = ["name", "email", "phone", "notes"] as const;

type CustomerFormValues = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type CustomerFormProps = {
  action: (
    previousState: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
  submitLabel: string;
  initialValues?: CustomerFormValues;
  disabled?: boolean;
  presentation?: "default" | "detail" | "create";
  cancelHref?: Route;
};

function fieldError(state: CustomerActionState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

function SubmitButton({
  label,
  detailPresentation = false,
  createPresentation = false,
}: {
  label: string;
  detailPresentation?: boolean;
  createPresentation?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={
        detailPresentation || createPresentation
          ? "h-14 w-full rounded-lg text-base font-semibold"
          : "w-full sm:w-fit"
      }
    >
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Please wait..." : label}
    </Button>
  );
}

type DetailFieldProps = {
  id: "name" | "email" | "phone" | "notes";
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  value: string;
  error?: string;
  disabled: boolean;
  type?: "email" | "tel" | "text";
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  optional?: boolean;
  showRequiredIndicator?: boolean;
  currentLength?: number;
  onValueChange?: (value: string) => void;
};

function DetailField({
  id,
  label,
  icon: Icon,
  value,
  error,
  disabled,
  type = "text",
  autoComplete,
  placeholder,
  required = false,
  multiline = false,
  optional = false,
  showRequiredIndicator = false,
  currentLength,
  onValueChange,
}: DetailFieldProps) {
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const describedBy =
    [error ? errorId : null, currentLength !== undefined ? counterId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const sharedAccessibility = {
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center">
          <Label htmlFor={id} className="text-base">
            {label}
          </Label>
          {showRequiredIndicator ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {optional ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Optional
          </span>
        ) : null}
      </div>
      <div className="relative">
        <span
          className={
            multiline
              ? "pointer-events-none absolute inset-y-px left-px z-10 flex w-12 items-start justify-center rounded-l-lg border-r border-border bg-primary/5 pt-4 text-primary"
              : "pointer-events-none absolute inset-y-px left-px z-10 flex w-12 items-center justify-center rounded-l-lg border-r border-border bg-primary/5 text-primary"
          }
          aria-hidden="true"
        >
          <Icon className="size-5" aria-hidden={true} />
        </span>
        {multiline ? (
          <Textarea
            id={id}
            name={id}
            defaultValue={value}
            maxLength={5000}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onValueChange?.(event.target.value)}
            className="min-h-32 resize-y rounded-lg py-3 pl-16 pr-4 text-base shadow-none"
            {...sharedAccessibility}
          />
        ) : (
          <Input
            id={id}
            name={id}
            type={type}
            defaultValue={value}
            autoComplete={autoComplete}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            className="h-14 rounded-lg pl-16 pr-4 text-base shadow-none"
            {...sharedAccessibility}
          />
        )}
      </div>
      {error ? (
        <p id={errorId} className="text-sm leading-5 text-destructive">
          {error}
        </p>
      ) : null}
      {currentLength !== undefined ? (
        <p
          id={counterId}
          className="text-right text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {currentLength}/5000
        </p>
      ) : null}
    </div>
  );
}

export function CustomerForm({
  action,
  submitLabel,
  initialValues = {},
  disabled = false,
  presentation = "default",
  cancelHref,
}: CustomerFormProps) {
  const [actionState, formAction] = useActionState(action, initialCustomerActionState);
  const { formRef, visibleFieldErrors, onInputCapture, onChangeCapture } =
    useFormErrorNavigation(actionState.fieldErrors, customerFieldOrder);
  const state = { ...actionState, fieldErrors: visibleFieldErrors };
  const [createNotesLength, setCreateNotesLength] = useState(
    initialValues.notes?.length ?? 0,
  );

  if (presentation === "create") {
    return (
      <form
        ref={formRef}
        action={formAction}
        onInputCapture={onInputCapture}
        onChangeCapture={onChangeCapture}
        className="space-y-4 sm:space-y-5"
        noValidate
      >
        {state.message ? (
          <div
            className="flex gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm"
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

        <Card className="shadow-[0_3px_12px_rgba(23,33,29,0.06)]">
          <CardHeader className="flex-row items-center gap-3 p-4 pb-5 sm:p-5 sm:pb-5">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary"
              aria-hidden="true"
            >
              <UserRound className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">Customer details</CardTitle>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Add contact information to keep your records organized.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
            <DetailField
              id="name"
              label="Name"
              icon={UserRound}
              value={initialValues.name ?? ""}
              error={fieldError(state, "name")}
              disabled={disabled}
              autoComplete="name"
              placeholder="Enter customer name"
              required
              showRequiredIndicator
            />
            <DetailField
              id="email"
              label="Saved contact email"
              icon={Mail}
              value={initialValues.email ?? ""}
              error={fieldError(state, "email")}
              disabled={disabled}
              type="email"
              autoComplete="off"
              placeholder="Add a saved contact email"
              optional
            />
            <DetailField
              id="phone"
              label="Phone"
              icon={Phone}
              value={initialValues.phone ?? ""}
              error={fieldError(state, "phone")}
              disabled={disabled}
              type="tel"
              autoComplete="tel"
              placeholder="Enter phone number (optional)"
              optional
            />
            <DetailField
              id="notes"
              label="Notes"
              icon={NotebookPen}
              value={initialValues.notes ?? ""}
              error={fieldError(state, "notes")}
              disabled={disabled}
              placeholder="Add any helpful notes about this customer..."
              multiline
              optional
              currentLength={createNotesLength}
              onValueChange={(value) => setCreateNotesLength(value.length)}
            />

            <div className="flex gap-3 rounded-lg border border-primary/10 bg-primary/[0.045] p-4 text-sm leading-6 text-primary">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>
                Customer details are private to your business and help you manage bookings
                and communication.
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] gap-3">
              {cancelHref ? (
                <Button
                  asChild
                  variant="secondary"
                  className="h-14 w-full rounded-lg text-sm font-semibold min-[390px]:text-base"
                >
                  <Link href={cancelHref}>Cancel</Link>
                </Button>
              ) : null}
              <div className={cancelHref ? "min-w-0" : "col-span-2"}>
                <SubmitButton label={submitLabel} createPresentation />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    );
  }

  if (presentation === "detail") {
    return (
      <form
        ref={formRef}
        action={formAction}
        onInputCapture={onInputCapture}
        onChangeCapture={onChangeCapture}
        className="space-y-4 sm:space-y-5"
        noValidate
      >
        {state.message ? (
          <div
            className="flex gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm"
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

        <Card className="shadow-[0_3px_12px_rgba(23,33,29,0.06)]">
          <CardHeader className="flex-row items-center gap-3 p-4 pb-5 sm:p-5 sm:pb-5">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/5 text-primary"
              aria-hidden="true"
            >
              <UserRound className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">Customer details</CardTitle>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Update your customer information
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
            <DetailField
              id="name"
              label="Name"
              icon={UserRound}
              value={initialValues.name ?? ""}
              error={fieldError(state, "name")}
              disabled={disabled}
              autoComplete="name"
              required
            />
            <DetailField
              id="email"
              label="Saved contact email"
              icon={Mail}
              value={initialValues.email ?? ""}
              error={fieldError(state, "email")}
              disabled={disabled}
              type="email"
              autoComplete="off"
              placeholder="Not added"
              optional
            />
            <DetailField
              id="phone"
              label="Phone (optional)"
              icon={Phone}
              value={initialValues.phone ?? ""}
              error={fieldError(state, "phone")}
              disabled={disabled}
              type="tel"
              autoComplete="tel"
              placeholder="Enter phone number"
            />
            <DetailField
              id="notes"
              label="Notes (optional)"
              icon={NotebookPen}
              value={initialValues.notes ?? ""}
              error={fieldError(state, "notes")}
              disabled={disabled}
              placeholder="Add any notes about this customer..."
              multiline
            />
          </CardContent>
        </Card>

        {!disabled ? (
          <SubmitButton label={submitLabel} detailPresentation />
        ) : (
          <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Archived customers are read-only in Phase 4.
          </p>
        )}
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onInputCapture={onInputCapture}
      onChangeCapture={onChangeCapture}
      className="space-y-5"
      noValidate
    >
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={initialValues.name ?? ""}
            autoComplete="name"
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "name"))}
            aria-describedby={fieldError(state, "name") ? "name-error" : undefined}
          />
          {fieldError(state, "name") ? (
            <p id="name-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "name")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Saved contact email (optional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues.email ?? ""}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "email"))}
            aria-describedby={fieldError(state, "email") ? "email-error" : undefined}
          />
          {fieldError(state, "email") ? (
            <p id="email-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "email")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initialValues.phone ?? ""}
            autoComplete="tel"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "phone"))}
            aria-describedby={fieldError(state, "phone") ? "phone-error" : undefined}
          />
          {fieldError(state, "phone") ? (
            <p id="phone-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "phone")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={initialValues.notes ?? ""}
            maxLength={5000}
            disabled={disabled}
          />
          {fieldError(state, "notes") ? (
            <p className="text-sm leading-5 text-destructive">
              {fieldError(state, "notes")}
            </p>
          ) : null}
        </div>
      </div>

      {!disabled ? <SubmitButton label={submitLabel} /> : null}
    </form>
  );
}
