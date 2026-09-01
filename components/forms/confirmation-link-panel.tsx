"use client";

import { useActionState, type ComponentType, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Eye,
  Link2,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import { Button } from "@/components/ui/button";
import type { ConfirmationLinkSummary } from "@/features/confirmation-links/queries";
import {
  initialConfirmationLinkActionState,
  type ConfirmationLinkActionState,
} from "@/features/confirmation-links/action-state";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";
import { cn } from "@/lib/utils/cn";

type ConfirmationLinkPanelProps = {
  summary: ConfirmationLinkSummary;
  canManage: boolean;
  businessName: string;
  customerName: string | null;
  customerProfileEmail: string | null;
  generateAction: (
    previousState: ConfirmationLinkActionState,
    formData: FormData,
  ) => Promise<ConfirmationLinkActionState>;
  revokeAction: (
    previousState: ConfirmationLinkActionState,
    formData: FormData,
  ) => Promise<ConfirmationLinkActionState>;
  recordShareAction: (
    confirmationLinkId: string,
    method: ConfirmationShareMethod,
  ) => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shareMethodLabel(method: ConfirmationShareMethod) {
  const labels: Record<ConfirmationShareMethod, string> = {
    native_share: "System share",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    copy_message: "Copy message",
    copy_link: "Copy link",
  };

  return labels[method];
}

function SubmitButton({
  label,
  pendingLabel,
  variant = "secondary",
  icon,
  className,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "destructive";
  icon: "generate" | "regenerate" | "revoke";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const Icon =
    icon === "generate" ? Link2 : icon === "regenerate" ? RefreshCw : XCircle;

  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      disabled={pending}
      className={className}
    >
      <Icon className="size-4" aria-hidden="true" />
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-3 sm:grid-cols-[2rem_8.5rem_minmax(0,1fr)] sm:items-center">
      <span className="row-span-2 grid size-8 place-items-center text-muted-foreground sm:row-span-1">
        <Icon className="size-[1.125rem]" aria-hidden={true} />
      </span>
      <dt className="min-w-0 text-sm font-medium leading-5 text-muted-foreground">
        {label}
      </dt>
      <dd className="col-start-2 mt-0.5 min-w-0 break-words text-sm font-medium leading-5 text-foreground sm:col-start-3 sm:mt-0">
        {children}
      </dd>
    </div>
  );
}

const statusPresentation: Record<
  ConfirmationLinkSummary["status"],
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-primary/15 bg-primary/[0.07] text-primary",
  },
  used: {
    label: "Customer confirmed",
    className: "border-primary/15 bg-primary/[0.07] text-primary",
  },
  expired: {
    label: "Expired",
    className: "border-border bg-muted text-muted-foreground",
  },
  revoked: {
    label: "Revoked",
    className: "border-destructive/20 bg-destructive/5 text-destructive",
  },
  none: {
    label: "Not generated",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function ConfirmationLinkPanel({
  summary,
  canManage,
  businessName,
  customerName,
  customerProfileEmail,
  generateAction,
  revokeAction,
  recordShareAction,
}: ConfirmationLinkPanelProps) {
  const [generateState, generateFormAction] = useActionState(
    generateAction,
    initialConfirmationLinkActionState,
  );
  const [revokeState, revokeFormAction] = useActionState(
    revokeAction,
    initialConfirmationLinkActionState,
  );
  const active = summary.status === "active";
  const confirmed = summary.status === "used" || Boolean(summary.confirmedAt);
  const canGenerateFresh =
    canManage && ["none", "revoked", "expired"].includes(summary.status);
  const generatedUrl = generateState.confirmationUrl;
  const generatedLinkId = generateState.confirmationLinkId;
  const rawShareUrlAvailable = Boolean(generatedUrl && generatedLinkId);
  const status = statusPresentation[summary.status];
  const showGenerateMessage =
    generateState.message &&
    (generateState.status === "error" ||
      (active && generateState.message !== "Confirmation link generated."));
  const showRevokeMessage =
    revokeState.message && (revokeState.status === "error" || !active);
  const profileEmailDiffers = Boolean(
    summary.contactEmail &&
    customerProfileEmail &&
    summary.contactEmail.trim().toLowerCase() !==
      customerProfileEmail.trim().toLowerCase(),
  );

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-border border-y border-border">
        <DetailRow icon={CircleDot} label="Status">
          <span
            className={cn(
              "inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold leading-4",
              status.className,
            )}
          >
            {status.label}
          </span>
        </DetailRow>
        <DetailRow icon={CalendarDays} label="Created">
          {formatDateTime(summary.createdAt)}
        </DetailRow>
        <DetailRow icon={Clock3} label="Expires">
          {formatDateTime(summary.expiresAt)}
        </DetailRow>
        <DetailRow icon={CheckCircle2} label="Confirmed">
          {formatDateTime(summary.confirmedAt)}
        </DetailRow>
        <DetailRow icon={Send} label="Last share action">
          <span>
            {summary.shareMethod
              ? `${shareMethodLabel(summary.shareMethod)} selected · ${formatDateTime(summary.sharedAt)}`
              : "Not shared from My Kustomers"}
          </span>
        </DetailRow>
        <DetailRow icon={Eye} label="First viewed">
          {formatDateTime(summary.firstOpenedAt)}
        </DetailRow>
      </dl>

      {summary.contactEmail ? (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Booking contact</p>
            <p className="mt-1 break-all text-sm">{summary.contactEmail}</p>
          </div>
          {profileEmailDiffers ? (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Customer profile email
              </p>
              <p className="mt-1 break-all text-sm">{customerProfileEmail}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Contact phone</p>
            <p className="mt-1 text-sm">{summary.contactPhone ?? "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Confirmation email
            </p>
            <p className="mt-1 text-sm capitalize">
              {summary.emailStatus?.toLowerCase().replace("_", " ") ?? "Not queued"}
            </p>
          </div>
        </div>
      ) : null}

      {active && generatedUrl && generatedLinkId ? (
        <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
              <ShieldCheck className="size-5" aria-hidden={true} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold leading-5">
                Your confirmation request is ready.
              </p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                Share it now. This exact secure link is shown only once.
              </p>
            </div>
          </div>
          <input
            readOnly
            value={generatedUrl}
            className="sr-only"
            aria-label="Generated confirmation link"
          />
          <CustomerConfirmationShare
            businessName={businessName}
            customerName={customerName}
            confirmationUrl={generatedUrl}
            recordShare={recordShareAction.bind(null, generatedLinkId)}
            triggerClassName="h-11 w-full sm:w-full"
          />
        </div>
      ) : null}

      {showGenerateMessage ? (
        <p className="text-sm text-muted-foreground">{showGenerateMessage}</p>
      ) : null}
      {showRevokeMessage ? (
        <p className="text-sm text-muted-foreground">{showRevokeMessage}</p>
      ) : null}

      {canManage ? (
        <div className="space-y-3">
          {active ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                <Link2 className="size-[1.125rem]" aria-hidden={true} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">
                  {rawShareUrlAvailable
                    ? "Confirmation link generated."
                    : "An active confirmation link exists."}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  {rawShareUrlAvailable
                    ? "Manage your link options below."
                    : "The exact secure link is no longer available here. Regenerate it to create a fresh shareable link."}
                </p>
              </div>
            </div>
          ) : null}

          {canGenerateFresh ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                <Link2 className="size-[1.125rem]" aria-hidden={true} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">
                  {summary.status === "none"
                    ? "No confirmation link generated yet."
                    : summary.status === "revoked"
                      ? "Confirmation link revoked."
                      : "Confirmation link expired."}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  Generate a secure link when you&apos;re ready to ask the customer to
                  confirm.
                </p>
              </div>
            </div>
          ) : null}

          {active || canGenerateFresh ? (
            <div className="grid gap-2 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap">
              <form action={generateFormAction} className="min-w-0">
                <SubmitButton
                  label={
                    active
                      ? "Regenerate link"
                      : summary.status === "none"
                        ? "Generate confirmation link"
                        : "Generate new confirmation link"
                  }
                  pendingLabel={active ? "Regenerating..." : "Generating..."}
                  variant={active ? "secondary" : "primary"}
                  icon={active ? "regenerate" : "generate"}
                  className={cn(
                    "w-full sm:w-auto",
                    active &&
                      "border-primary text-primary hover:bg-primary/[0.05] hover:text-primary",
                  )}
                />
              </form>

              {active ? (
                <form action={revokeFormAction} className="min-w-0">
                  <SubmitButton
                    label="Revoke link"
                    pendingLabel="Revoking..."
                    variant="secondary"
                    icon="revoke"
                    className="w-full border-destructive/70 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
                  />
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {confirmed
            ? "Customer confirmation is recorded for this booking."
            : "Confirmation links can only be generated while the booking is draft or awaiting customer confirmation."}
        </p>
      )}
    </div>
  );
}
