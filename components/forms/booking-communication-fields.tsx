"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingCommunicationFields({
  errors = {},
}: {
  errors?: Record<string, string[] | undefined>;
}) {
  const [whatsapp, setWhatsApp] = useState(false);
  const { pending } = useFormStatus();
  const checkbox =
    "mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <fieldset
      disabled={pending}
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <legend className="px-1 text-base font-semibold">Customer updates</legend>
      <input type="hidden" name="communicationPreference" value="true" />
      <p className="text-sm text-muted-foreground">
        Choose how to send updates for this booking. Customer contact requirements stay
        the same.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <label className="flex min-h-11 items-center gap-2">
          <input
            id="emailEnabled"
            className={checkbox}
            type="checkbox"
            name="emailEnabled"
            defaultChecked
          />{" "}
          Email
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            className={checkbox}
            type="checkbox"
            name="whatsappEnabled"
            checked={whatsapp}
            onChange={(e) => setWhatsApp(e.target.checked)}
          />{" "}
          WhatsApp
        </label>
      </div>
      {errors.emailEnabled?.[0] && (
        <p role="alert" className="text-sm text-destructive">
          {errors.emailEnabled[0]}
        </p>
      )}
      {whatsapp && (
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="whatsappRecipient">WhatsApp number</Label>
            <Input
              id="whatsappRecipient"
              name="whatsappRecipient"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={30}
              aria-describedby="whatsapp-phone-help whatsapp-phone-error"
              aria-invalid={Boolean(errors.whatsappRecipient)}
            />
            <p id="whatsapp-phone-help" className="text-sm text-muted-foreground">
              Include + and the country code.
            </p>
            <p
              id="whatsapp-phone-error"
              role={errors.whatsappRecipient ? "alert" : undefined}
              className="text-sm text-destructive"
            >
              {errors.whatsappRecipient?.[0]}
            </p>
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
            <input
              id="whatsappConsent"
              className={checkbox}
              type="checkbox"
              name="whatsappConsent"
              aria-describedby="whatsapp-consent-error"
              aria-invalid={Boolean(errors.whatsappConsent)}
            />
            <span>
              The customer agreed to receive WhatsApp updates for this booking at this
              number.
            </span>
          </label>
          <p
            id="whatsapp-consent-error"
            role={errors.whatsappConsent ? "alert" : undefined}
            className="text-sm text-destructive"
          >
            {errors.whatsappConsent?.[0]}
          </p>
        </div>
      )}
    </fieldset>
  );
}
