import { AlertTriangle, CheckCircle2, Clock3, Info, MailWarning } from "lucide-react";
import type { EmailRecoveryPresentation } from "@/features/provider-delivery/model";
import { cn } from "@/lib/utils/cn";

const actionLabels: Record<
  NonNullable<EmailRecoveryPresentation["primaryAction"]>,
  string
> = {
  share_confirmation: "Share confirmation",
  share_whatsapp: "Share through WhatsApp",
  check_email: "Check email",
  edit_email: "Edit email",
  use_another_contact_method: "Use another contact method",
  add_email: "Add email",
};

export function EmailDeliveryStatus({
  presentation,
  providerStatus,
}: {
  presentation: EmailRecoveryPresentation;
  providerStatus?: string;
}) {
  const Icon =
    presentation.tone === "positive"
      ? CheckCircle2
      : providerStatus === "DEFERRED"
        ? Clock3
        : presentation.tone === "critical"
          ? MailWarning
          : presentation.tone === "warning"
            ? AlertTriangle
            : Info;

  return (
    <section
      data-provider-delivery={providerStatus ?? "NONE"}
      aria-label={presentation.ariaLabel}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm",
        presentation.tone === "positive"
          ? "border-primary/20 bg-primary/[0.04]"
          : presentation.tone === "critical"
            ? "border-destructive/25 bg-destructive/[0.04]"
            : presentation.tone === "warning"
              ? "border-amber-300/60 bg-amber-50/60"
              : "border-border bg-muted/45",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          presentation.tone === "critical"
            ? "bg-destructive/[0.08] text-destructive"
            : presentation.tone === "warning"
              ? "bg-amber-100 text-amber-800"
              : "bg-primary/[0.07] text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-5">{presentation.title}</p>
        <p className="mt-0.5 leading-5 text-muted-foreground">
          {presentation.description}
        </p>
        {presentation.transportTitle ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Earlier email status: {presentation.transportTitle}
          </p>
        ) : null}
        {presentation.primaryAction ? (
          <p className="mt-1.5 text-xs font-medium leading-5 text-foreground">
            Recommended: {actionLabels[presentation.primaryAction]}
          </p>
        ) : null}
      </div>
    </section>
  );
}
