"use client";

import {
  type FormEvent,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialPublicConfirmationActionState,
  type PublicConfirmationActionState,
} from "@/features/confirmation-links/public-action-state";
import { confirmationContactSchema } from "@/features/confirmation-links/validation";

type PublicConfirmationFormProps = {
  action: (
    previousState: PublicConfirmationActionState,
    formData: FormData,
  ) => Promise<PublicConfirmationActionState>;
};

type ContactFieldErrors = NonNullable<
  PublicConfirmationActionState["fieldErrors"]
>;

export function PublicConfirmationForm({ action }: PublicConfirmationFormProps) {
  const finalSubmissionStartedRef = useRef(false);
  const runConfirmationAction = useCallback(
    async (previousState: PublicConfirmationActionState, formData: FormData) => {
      try {
        return await action(previousState, formData);
      } finally {
        finalSubmissionStartedRef.current = false;
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(
    runConfirmationAction,
    initialPublicConfirmationActionState,
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusEmailAfterEditRef = useRef(false);

  useEffect(() => {
    if (isReviewing) {
      reviewHeadingRef.current?.focus();
      return;
    }

    if (focusEmailAfterEditRef.current) {
      focusEmailAfterEditRef.current = false;
      emailInputRef.current?.focus();
    }
  }, [isReviewing]);

  function reviewContactDetails() {
    const result = confirmationContactSchema.safeParse({
      contactEmail: email,
      contactPhone: phone,
    });

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors(errors);

      if (errors.contactEmail) {
        emailInputRef.current?.focus();
      } else if (errors.contactPhone) {
        phoneInputRef.current?.focus();
      }
      return;
    }

    setEmail(result.data.contactEmail);
    setPhone(result.data.contactPhone ?? "");
    setFieldErrors({});
    finalSubmissionStartedRef.current = false;
    setIsReviewing(true);
  }

  function editEmail() {
    focusEmailAfterEditRef.current = true;
    setIsReviewing(false);
  }

  function guardFinalSubmission(event: FormEvent<HTMLFormElement>) {
    if (finalSubmissionStartedRef.current) {
      event.preventDefault();
      return;
    }

    finalSubmissionStartedRef.current = true;
  }

  const visibleFieldErrors = {
    contactEmail: fieldErrors.contactEmail ?? state.fieldErrors?.contactEmail,
    contactPhone: fieldErrors.contactPhone ?? state.fieldErrors?.contactPhone,
  };

  return (
    <form
      action={formAction}
      className="mt-7"
      noValidate
      onSubmit={guardFinalSubmission}
    >
      {isReviewing ? (
        <section
          aria-labelledby="confirm-email-heading"
          className="rounded-xl border border-[#ccddd5] bg-[#f7faf8] p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e3eee8] text-primary">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="confirm-email-heading"
                ref={reviewHeadingRef}
                tabIndex={-1}
                className="text-lg font-semibold outline-none"
              >
                Confirm your email
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Booking updates will be sent to:
              </p>
              <p
                className="mt-2 break-all font-semibold text-foreground"
                data-testid="reviewed-email"
              >
                {email}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Please make sure this address is correct.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This checks the address format only, not whether the mailbox exists or
                can receive email.
              </p>
            </div>
          </div>

          <input type="hidden" name="contact_email" value={email} />
          <input type="hidden" name="contact_phone" value={phone} />

          {state.message ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
            >
              {state.message}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-12 w-full"
              onClick={editEmail}
              disabled={pending}
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
              Edit email
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base shadow-sm"
              disabled={pending}
              aria-live="polite"
            >
              {pending ? "Confirming..." : "Confirm booking"}
              {!pending ? <ArrowRight className="size-5" aria-hidden="true" /> : null}
            </Button>
          </div>
        </section>
      ) : (
        <>
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
                    ref={emailInputRef}
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        contactEmail: undefined,
                      }));
                    }}
                    className="h-12 pl-11"
                    aria-invalid={Boolean(visibleFieldErrors.contactEmail)}
                    aria-describedby={
                      visibleFieldErrors.contactEmail
                        ? "contact-email-help contact-email-error"
                        : "contact-email-help"
                    }
                  />
                </div>
                <p
                  id="contact-email-help"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  Please enter a valid email address where we can send updates about
                  this booking.
                </p>
                {visibleFieldErrors.contactEmail?.[0] ? (
                  <p id="contact-email-error" className="text-sm text-destructive">
                    {visibleFieldErrors.contactEmail[0]}
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
                    ref={phoneInputRef}
                    id="contact_phone"
                    name="contact_phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. 0803 123 4567"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        contactPhone: undefined,
                      }));
                    }}
                    className="h-12 pl-11"
                    aria-invalid={Boolean(visibleFieldErrors.contactPhone)}
                    aria-describedby={
                      visibleFieldErrors.contactPhone
                        ? "contact-phone-error"
                        : undefined
                    }
                  />
                </div>
                {visibleFieldErrors.contactPhone?.[0] ? (
                  <p id="contact-phone-error" className="text-sm text-destructive">
                    {visibleFieldErrors.contactPhone[0]}
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
                  Review the email address before confirming the booking details agreed
                  with the business.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Button
              type="button"
              size="lg"
              className="h-13 w-full text-base shadow-sm"
              onClick={reviewContactDetails}
            >
              Review and confirm
              <ArrowRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
