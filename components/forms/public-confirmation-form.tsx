"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialPublicConfirmationActionState,
  type PublicConfirmationActionState,
} from "@/features/confirmation-links/public-action-state";

type PublicConfirmationFormProps = {
  action: (
    previousState: PublicConfirmationActionState,
    formData: FormData,
  ) => Promise<PublicConfirmationActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      className="h-13 w-full text-base shadow-sm"
      disabled={pending}
      aria-live="polite"
    >
      {pending ? "Confirming..." : "Confirm booking"}
      {!pending ? <ArrowRight className="size-5" aria-hidden="true" /> : null}
    </Button>
  );
}

export function PublicConfirmationForm({ action }: PublicConfirmationFormProps) {
  const [state, formAction] = useActionState(
    action,
    initialPublicConfirmationActionState,
  );

  return (
    <form action={formAction} className="mt-7" noValidate>
      <section aria-labelledby="contact-details-heading">
        <h2 id="contact-details-heading" className="text-lg font-semibold">
          Your contact details
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          We&apos;ll use these to send booking updates.
        </p>

        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email address</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="h-12 pl-11"
                aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
                aria-describedby={
                  state.fieldErrors?.contactEmail
                    ? "contact-email-help contact-email-error"
                    : "contact-email-help"
                }
              />
            </div>
            <p
              id="contact-email-help"
              className="text-xs leading-5 text-muted-foreground"
            >
              Please enter a valid email address where we can send updates about this
              booking.
            </p>
            {state.fieldErrors?.contactEmail?.[0] ? (
              <p id="contact-email-error" className="text-sm text-destructive">
                {state.fieldErrors.contactEmail[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Phone number (optional)</Label>
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. 0803 123 4567"
                className="h-12 pl-11"
                aria-invalid={Boolean(state.fieldErrors?.contactPhone)}
                aria-describedby={
                  state.fieldErrors?.contactPhone ? "contact-phone-error" : undefined
                }
              />
            </div>
            {state.fieldErrors?.contactPhone?.[0] ? (
              <p id="contact-phone-error" className="text-sm text-destructive">
                {state.fieldErrors.contactPhone[0]}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-lg border border-[#ccddd5] bg-[#f2f7f4] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e3eee8] text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">You&apos;re in control</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              By confirming, you acknowledge that these are the booking details agreed
              with the business.
            </p>
          </div>
        </div>
      </div>

      {state.message ? (
        <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}

      <div className="mt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
