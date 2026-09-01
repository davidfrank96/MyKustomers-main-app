"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
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
  placeholder?: string;
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
  presentation?: "card" | "mobile";
};

function SubmitButton({
  label,
  mobilePresentation,
}: {
  label: string;
  mobilePresentation: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className={
        mobilePresentation ? "h-14 w-full rounded-lg text-base text-white" : "w-full"
      }
      disabled={pending}
    >
      {pending ? "Please wait..." : label}
    </Button>
  );
}

function AuthFieldControl({
  field,
  errors,
  mobilePresentation,
}: {
  field: AuthField;
  errors: string[];
  mobilePresentation: boolean;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorId = `${field.name}-error`;
  const passwordToggleAvailable = mobilePresentation && field.type === "password";
  const inputType = passwordToggleAvailable && passwordVisible ? "text" : field.type;
  const toggleLabel = `${passwordVisible ? "Hide" : "Show"} ${field.label.toLowerCase()}`;

  return (
    <div className={mobilePresentation ? "space-y-2.5" : "space-y-2"}>
      <Label htmlFor={field.name} className={mobilePresentation ? "text-base" : undefined}>
        {field.label}
      </Label>
      <div className="relative">
        <Input
          id={field.name}
          name={field.name}
          type={inputType}
          autoComplete={field.autoComplete}
          required={field.required}
          placeholder={field.placeholder}
          className={
            mobilePresentation
              ? `h-14 rounded-lg px-4 text-base ${passwordToggleAvailable ? "pr-12" : ""}`
              : undefined
          }
          aria-invalid={errors.length > 0}
          aria-describedby={errors.length > 0 ? errorId : undefined}
        />
        {passwordToggleAvailable ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 grid min-h-11 w-12 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
            aria-label={toggleLabel}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {errors.length > 0 ? (
        <p id={errorId} className="text-sm leading-5 text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
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
  presentation = "card",
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const mobilePresentation = presentation === "mobile";

  return (
    <section
      className={
        mobilePresentation
          ? "w-full py-2 sm:py-4"
          : "w-full rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6"
      }
    >
      <div className={mobilePresentation ? "text-center" : undefined}>
        <Link
          href="/"
          className={
            mobilePresentation
              ? "mx-auto flex w-fit items-center justify-center gap-3"
              : "flex w-fit items-center gap-3"
          }
          aria-label="My Kustomers home"
        >
          <span
            className={
              mobilePresentation
                ? "grid size-12 place-items-center rounded-lg bg-primary text-base font-semibold text-primary-foreground"
                : "grid size-10 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            }
          >
            MK
          </span>
          <span
            className={
              mobilePresentation
                ? "text-xl font-semibold text-primary"
                : "text-base font-semibold"
            }
          >
            My Kustomers
          </span>
        </Link>
        <h1
          className={
            mobilePresentation
              ? "mt-10 break-words text-3xl font-semibold leading-tight"
              : "mt-8 text-2xl font-semibold leading-tight"
          }
        >
          {title}
        </h1>
        <p
          className={
            mobilePresentation
              ? "mx-auto mt-3 max-w-sm text-base leading-6 text-muted-foreground"
              : "mt-2 text-sm leading-6 text-muted-foreground"
          }
        >
          {description}
        </p>
      </div>

      {message ? (
        <p
          className={
            mobilePresentation
              ? "mt-8 rounded-lg border border-border bg-muted/70 px-4 py-3 text-sm leading-6 text-muted-foreground"
              : "mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          }
          role="status"
        >
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
          <GoogleAuthButton
            enabled={googleAuth.enabled}
            next={googleAuth.next}
            mobilePresentation={mobilePresentation}
          />
          <div
            className={mobilePresentation ? "my-7 flex items-center gap-4" : "my-6 flex items-center gap-3"}
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-border" />
            <span className={mobilePresentation ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"}>
              or continue with email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form
        action={formAction}
        className={
          mobilePresentation
            ? "space-y-5"
            : googleAuth
              ? "space-y-4"
              : "mt-6 space-y-4"
        }
        noValidate
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {fields.map((field) => {
          const errors = state.fieldErrors?.[field.name] ?? [];

          return (
            <AuthFieldControl
              key={field.name}
              field={field}
              errors={errors}
              mobilePresentation={mobilePresentation}
            />
          );
        })}

        <SubmitButton label={submitLabel} mobilePresentation={mobilePresentation} />
      </form>

      {footer ? (
        <div
          className={
            mobilePresentation
              ? "mt-7 text-center text-sm leading-6 text-muted-foreground"
              : "mt-6 text-sm leading-6 text-muted-foreground"
          }
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}
