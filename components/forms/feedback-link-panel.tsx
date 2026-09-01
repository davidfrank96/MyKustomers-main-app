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
import {
  initialFeedbackLinkActionState,
  type FeedbackLinkActionState,
} from "@/features/feedback/action-state";
import type { FeedbackLinkSummary } from "@/features/feedback/queries";
import {
  buildFeedbackShareMessage,
  buildFeedbackShareTitle,
  type FeedbackShareMethod,
} from "@/features/feedback/share";
import { cn } from "@/lib/utils/cn";

type FeedbackLinkPanelProps = {
  summary: FeedbackLinkSummary;
  canManage: boolean;
  generateAction: (
    previousState: FeedbackLinkActionState,
    formData: FormData,
  ) => Promise<FeedbackLinkActionState>;
  revokeAction: (
    previousState: FeedbackLinkActionState,
    formData: FormData,
  ) => Promise<FeedbackLinkActionState>;
  businessName: string;
  customerName: string | null;
  recordShareAction: (
    feedbackLinkId: string,
    method: FeedbackShareMethod,
  ) => Promise<void>;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shareMethodLabel(method: FeedbackShareMethod) {
  const labels: Record<FeedbackShareMethod, string> = {
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
      size="md"
      disabled={pending}
      className={cn("min-w-0 whitespace-nowrap", className)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{pending ? pendingLabel : label}</span>
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
  FeedbackLinkSummary["status"],
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-primary/15 bg-primary/[0.07] text-primary",
  },
  submitted: {
    label: "Feedback submitted",
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
    label: "None",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function FeedbackLinkPanel({
  summary,
  canManage,
  generateAction,
  revokeAction,
  businessName,
  customerName,
  recordShareAction,
}: FeedbackLinkPanelProps) {
  const [generateState, generateFormAction] = useActionState(
    generateAction,
    initialFeedbackLinkActionState,
  );
  const [revokeState, revokeFormAction] = useActionState(
    revokeAction,
    initialFeedbackLinkActionState,
  );
  const active = summary.status === "active";
  const canGenerateFresh =
    canManage && ["none", "revoked", "expired"].includes(summary.status);
  const generatedUrl = generateState.feedbackUrl;
  const generatedLinkId = generateState.feedbackLinkId;
  const rawShareUrlAvailable = Boolean(active && generatedUrl && generatedLinkId);
  const status = statusPresentation[summary.status];
  const showGenerateMessage =
    generateState.message &&
    (generateState.status === "error" ||
      (active && generateState.message !== "Feedback link generated."));
  const showRevokeMessage =
    revokeState.message && (revokeState.status === "error" || !active);

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
        <DetailRow icon={CheckCircle2} label="Submitted">
          {formatDateTime(summary.submittedAt)}
        </DetailRow>
        <DetailRow icon={Send} label="Last share action">
          {summary.shareMethod
            ? `${shareMethodLabel(summary.shareMethod)} selected · ${formatDateTime(summary.sharedAt)}`
            : "Not shared from My Kustomers"}
        </DetailRow>
        <DetailRow icon={Eye} label="First viewed">
          {formatDateTime(summary.firstOpenedAt)}
        </DetailRow>
      </dl>

      {rawShareUrlAvailable && generatedUrl && generatedLinkId ? (
        <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold leading-5">
                Your private feedback request is ready.
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
            aria-label="Generated feedback link"
          />
          <CustomerConfirmationShare
            businessName={businessName}
            customerName={customerName}
            confirmationUrl={generatedUrl}
            recordShare={recordShareAction.bind(null, generatedLinkId)}
            initialMessage={buildFeedbackShareMessage({ businessName, customerName })}
            shareTitle={buildFeedbackShareTitle(businessName)}
            triggerLabel="Share feedback request"
            dialogTitle="Share feedback request"
            dialogDescription="Send a private feedback request with a secure link that does not require an account."
            linkLabel="Feedback link"
            messageHelp="You can edit this message before sharing. The secure feedback link will be included automatically."
            idPrefix="feedback"
            triggerClassName="h-11 w-full min-w-0 gap-2 whitespace-nowrap px-3 text-sm sm:w-full"
          />
        </div>
      ) : null}

      {showGenerateMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {showGenerateMessage}
        </p>
      ) : null}
      {showRevokeMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {showRevokeMessage}
        </p>
      ) : null}

      {canManage ? (
        <div className="space-y-3">
          {active ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                <Link2 className="size-[1.125rem]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">
                  {rawShareUrlAvailable
                    ? "Feedback link generated."
                    : "An active feedback request exists."}
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
                <Link2 className="size-[1.125rem]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">
                  {summary.status === "none"
                    ? "No private feedback request yet."
                    : summary.status === "revoked"
                      ? "Feedback link revoked."
                      : "Feedback link expired."}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  Generate a secure request when you&apos;re ready to collect private
                  feedback.
                </p>
              </div>
            </div>
          ) : null}

          {active || canGenerateFresh ? (
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <form
                action={generateFormAction}
                className={cn(
                  "min-w-0",
                  canGenerateFresh && "w-full sm:w-auto",
                )}
              >
                <SubmitButton
                  label={
                    active
                      ? "Regenerate feedback link"
                      : summary.status === "none"
                        ? "Request feedback"
                        : "Request feedback again"
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
        <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm leading-5 text-muted-foreground">
          {summary.status === "submitted"
            ? "Private feedback has been submitted for this booking."
            : "Feedback requests are available after the booking is completed and before feedback is submitted."}
        </p>
      )}
    </div>
  );
}
