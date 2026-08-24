"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAuthButton } from "@/components/forms/google-auth-button";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/features/auth/action-state";

type AuthField = {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  required?: boolean;
};

type AuthFormProps = {
  title: string;
  description: string;
  action: (
    previousState: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  submitLabel: string;
  fields: AuthField[];
  hiddenFields?: Record<string, string>;
  footer?: ReactNode;
  message?: string;
  googleAuth?: {
    enabled: boolean;
    next: string;
  };
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Please wait..." : label}
    </Button>
  );
}

export function AuthForm({
  title,
  description,
  action,
  submitLabel,
  fields,
  hiddenFields = {},
  footer,
  message,
  googleAuth,
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);

  return (
    <section className="w-full rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div>
        <Link href="/" className="flex w-fit items-center gap-3" aria-label="My Customers home">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            MC
          </span>
          <span className="text-base font-semibold">My Customers</span>
        </Link>
        <h1 className="mt-8 text-2xl font-semibold leading-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {message ? (
        <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      {state.message ? (
        <div
          className="mt-5 flex gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
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

      {googleAuth ? (
        <>
          <GoogleAuthButton enabled={googleAuth.enabled} next={googleAuth.next} />
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with email</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form action={formAction} className={googleAuth ? "space-y-4" : "mt-6 space-y-4"} noValidate>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {fields.map((field) => {
          const errorId = `${field.name}-error`;
          const errors = state.fieldErrors?.[field.name] ?? [];

          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required={field.required}
                aria-invalid={errors.length > 0}
                aria-describedby={errors.length > 0 ? errorId : undefined}
              />
              {errors.length > 0 ? (
                <p id={errorId} className="text-sm leading-5 text-destructive">
                  {errors[0]}
                </p>
              ) : null}
            </div>
          );
        })}

        <SubmitButton label={submitLabel} />
      </form>

      {footer ? <div className="mt-6 text-sm leading-6 text-muted-foreground">{footer}</div> : null}
    </section>
  );
}
