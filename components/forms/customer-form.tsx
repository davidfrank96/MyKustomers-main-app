"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  initialCustomerActionState,
  type CustomerActionState,
} from "@/features/customers/action-state";

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
};

function fieldError(state: CustomerActionState, name: string) {
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

export function CustomerForm({
  action,
  submitLabel,
  initialValues = {},
  disabled = false,
}: CustomerFormProps) {
  const [state, formAction] = useActionState(action, initialCustomerActionState);

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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues.email ?? ""}
            autoComplete="email"
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
            <p className="text-sm leading-5 text-destructive">{fieldError(state, "notes")}</p>
          ) : null}
        </div>
      </div>

      {!disabled ? <SubmitButton label={submitLabel} /> : null}
    </form>
  );
}
