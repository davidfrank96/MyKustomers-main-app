"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Link2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import type { FeedbackLinkSummary } from "@/features/feedback/queries";
import {
  initialFeedbackLinkActionState,
  type FeedbackLinkActionState,
} from "@/features/feedback/action-state";
import {
  buildFeedbackShareMessage,
  buildFeedbackShareTitle,
  type FeedbackShareMethod,
} from "@/features/feedback/share";

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
  if (!value) {
    return "Not available";
  }

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
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "destructive";
  icon: "link" | "revoke";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "link" ? Link2 : XCircle;

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      <Icon className="size-4" aria-hidden="true" />
      {pending ? pendingLabel : label}
    </Button>
  );
}

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
  const generatedUrl = generateState.feedbackUrl;
  const generatedLinkId = generateState.feedbackLinkId;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium capitalize">{summary.status}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Created</p>
          <p className="mt-1 text-sm">{formatDateTime(summary.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Expires</p>
          <p className="mt-1 text-sm">{formatDateTime(summary.expiresAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Submitted</p>
          <p className="mt-1 text-sm">{formatDateTime(summary.submittedAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Last share action</p>
          <p className="mt-1 text-sm">
            {summary.shareMethod
              ? `${shareMethodLabel(summary.shareMethod)} selected · ${formatDateTime(summary.sharedAt)}`
              : "Not shared from My Customers"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">First viewed</p>
          <p className="mt-1 text-sm">{formatDateTime(summary.firstOpenedAt)}</p>
        </div>
      </div>

      {generatedUrl && generatedLinkId ? (
        <div className="space-y-4 rounded-md border border-border bg-muted p-3">
          <div>
            <p className="text-sm font-medium">Your private feedback request is ready.</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Share it now. This exact secure link is shown only once.
            </p>
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
          />
        </div>
      ) : null}

      {generateState.message ? (
        <p className="text-sm text-muted-foreground">{generateState.message}</p>
      ) : null}
      {revokeState.message ? (
        <p className="text-sm text-muted-foreground">{revokeState.message}</p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <form action={generateFormAction}>
            <SubmitButton
              label={active ? "Regenerate feedback link" : "Request feedback"}
              pendingLabel="Generating..."
              variant="primary"
              icon="link"
            />
          </form>

          {active ? (
            <form action={revokeFormAction}>
              <SubmitButton
                label="Revoke link"
                pendingLabel="Revoking..."
                variant="destructive"
                icon="revoke"
              />
            </form>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Feedback links can only be generated after completion and before feedback is
          submitted.
        </p>
      )}
    </div>
  );
}
