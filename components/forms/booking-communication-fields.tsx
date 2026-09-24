"use client";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Bell, Check, Mail, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { e164Schema } from "@/features/whatsapp/validation";
import { Label } from "@/components/ui/label";

export function BookingCommunicationFields({
  errors = {},
  customerPhone = "",
}: {
  errors?: Record<string, string[] | undefined>;
  customerPhone?: string | null;
}) {
  const [whatsapp, setWhatsApp] = useState(false);
  const { pending } = useFormStatus();

  return (
    <fieldset
      disabled={pending}
      aria-describedby="customer-updates-description"
      className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:space-y-6 sm:p-6"
    >
      <legend className="sr-only">Customer updates</legend>
      <input type="hidden" name="communicationPreference" value="true" />
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary sm:size-12">
          <Bell className="size-5 sm:size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              Customer updates
            </h2>
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-primary">
              Pro
            </Badge>
          </div>
          <p
            id="customer-updates-description"
            className="text-sm leading-6 text-muted-foreground"
          >
            Choose how your customer receives updates for this booking.
            <span className="block">You can select email, WhatsApp, or both.</span>
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <ChannelOption
          id="emailEnabled"
          name="emailEnabled"
          label="Email"
          description="Send updates by email"
          icon={<Mail className="size-6" aria-hidden="true" />}
          defaultChecked
        />
        <ChannelOption
          id="whatsappEnabled"
          name="whatsappEnabled"
          label="WhatsApp"
          description="Send updates by WhatsApp"
          icon={
            <span className="relative size-6" aria-hidden="true">
              <MessageCircle className="size-6" />
              <Phone className="absolute left-1.5 top-1.5 size-3" />
            </span>
          }
          checked={whatsapp}
          onChange={(e) => setWhatsApp(e.target.checked)}
        />
      </div>
      {errors.emailEnabled?.[0] && (
        <p role="alert" className="text-sm text-destructive">
          {errors.emailEnabled[0]}
        </p>
      )}
      {whatsapp && (
        <WhatsAppRecipient
          key={customerPhone ?? ""}
          customerPhone={customerPhone}
          errors={errors}
        />
      )}
    </fieldset>
  );
}

const checkbox =
  "mt-0.5 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function ChannelOption({
  label,
  description,
  icon,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <label className="relative block min-w-0 cursor-pointer">
      <input
        {...input}
        type="checkbox"
        aria-labelledby={`${input.id}-label`}
        aria-describedby={`${input.id}-description`}
        className="peer absolute right-4 top-4 size-5 appearance-none rounded-full border border-border bg-card checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed"
      />
      <Check
        className="pointer-events-none absolute right-4 top-4 size-5 p-0.5 text-primary-foreground opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
      />
      <div className="flex min-h-24 min-w-0 items-center gap-3 rounded-xl border border-border p-4 pr-12 transition-colors peer-checked:border-primary/60 peer-checked:bg-primary/[0.04] peer-focus-visible:ring-2 peer-focus-visible:ring-primary/25 peer-disabled:opacity-60 sm:min-h-28">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
          {icon}
        </span>
        <span className="min-w-0 space-y-1">
          <span
            id={`${input.id}-label`}
            className="block text-sm font-semibold sm:text-base"
          >
            {label}
          </span>
          <span
            id={`${input.id}-description`}
            className="block text-sm leading-5 text-muted-foreground"
          >
            {description}
          </span>
        </span>
      </div>
    </label>
  );
}

function WhatsAppRecipient({
  customerPhone,
  errors,
}: {
  customerPhone: string | null;
  errors: Record<string, string[] | undefined>;
}) {
  const [recipient, setRecipient] = useState(() => {
    const parsed = e164Schema.safeParse(customerPhone ?? "");
    return parsed.success ? parsed.data : "";
  });
  const [consent, setConsent] = useState(false);
  return (
    <div className="min-w-0 space-y-5 border-t border-border pt-5 sm:pt-6">
      <div className="space-y-2">
        <Label htmlFor="whatsappRecipient" className="text-sm font-semibold">
          WhatsApp number
        </Label>
        <Input
          id="whatsappRecipient"
          name="whatsappRecipient"
          value={recipient}
          onChange={(event) => {
            setRecipient(event.target.value);
            setConsent(false);
          }}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={30}
          className="h-12 rounded-xl px-4 text-base"
          aria-describedby="whatsapp-phone-help whatsapp-phone-error"
          aria-invalid={Boolean(errors.whatsappRecipient)}
        />
        <p id="whatsapp-phone-help" className="text-sm leading-6 text-muted-foreground">
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
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-primary/[0.05] p-4 text-sm leading-6 sm:p-5">
        <input
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          id="whatsappConsent"
          className={checkbox}
          type="checkbox"
          name="whatsappConsent"
          aria-describedby="whatsapp-consent-error"
          aria-invalid={Boolean(errors.whatsappConsent)}
        />
        <span>
          The customer agreed to receive WhatsApp updates for this booking at this number.
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
  );
}
