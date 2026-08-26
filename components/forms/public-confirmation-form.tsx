"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Confirming..." : "Confirm booking"}
    </Button>
  );
}

export function PublicConfirmationForm({ action }: PublicConfirmationFormProps) {
  const [state, formAction] = useActionState(
    action,
    initialPublicConfirmationActionState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="contact_email">Email address</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
          aria-describedby="contact-email-help contact-email-error"
        />
        <p id="contact-email-help" className="text-xs leading-5 text-muted-foreground">
          Please enter a valid email address where we can send updates about this booking.
        </p>
        {state.fieldErrors?.contactEmail?.[0] ? (
          <p id="contact-email-error" className="text-sm text-destructive">
            {state.fieldErrors.contactEmail[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_phone">Phone number (optional)</Label>
        <Input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={Boolean(state.fieldErrors?.contactPhone)}
          aria-describedby="contact-phone-error"
        />
        {state.fieldErrors?.contactPhone?.[0] ? (
          <p id="contact-phone-error" className="text-sm text-destructive">
            {state.fieldErrors.contactPhone[0]}
          </p>
        ) : null}
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        By confirming, you acknowledge that these are the booking details agreed with the
        business.
      </p>

      {state.message ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
