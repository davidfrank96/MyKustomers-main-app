"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Link2, XCircle } from "lucide-react";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import { Button } from "@/components/ui/button";
import type { ConfirmationLinkSummary } from "@/features/confirmation-links/queries";
import {
  initialConfirmationLinkActionState,
  type ConfirmationLinkActionState,
} from "@/features/confirmation-links/action-state";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";

type ConfirmationLinkPanelProps = {
  summary: ConfirmationLinkSummary;
  canManage: boolean;
  businessName: string;
  customerName: string | null;
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

export function ConfirmationLinkPanel({
  summary,
  canManage,
  businessName,
  customerName,
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
  const generatedUrl = generateState.confirmationUrl;
  const generatedLinkId = generateState.confirmationLinkId;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Status
          </p>
          <p className="mt-1 text-sm font-medium capitalize">{summary.status}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Created
          </p>
          <p className="mt-1 text-sm">{formatDateTime(summary.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Expires
          </p>
          <p className="mt-1 text-sm">{formatDateTime(summary.expiresAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Confirmed
          </p>
          <p className="mt-1 text-sm">{formatDateTime(summary.confirmedAt)}</p>
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

      {summary.contactEmail ? (
        <div className="grid gap-3 rounded-md border border-border bg-muted p-3 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Confirmation contact</p>
            <p className="mt-1 break-all text-sm">{summary.contactEmail}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Contact phone</p>
            <p className="mt-1 text-sm">{summary.contactPhone ?? "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Confirmation email</p>
            <p className="mt-1 text-sm capitalize">
              {summary.emailStatus?.toLowerCase().replace("_", " ") ?? "Not queued"}
            </p>
          </div>
        </div>
      ) : null}

      {generatedUrl && generatedLinkId ? (
        <div className="space-y-4 rounded-md border border-border bg-muted p-3">
          <div>
            <p className="text-sm font-medium">Your confirmation request is ready.</p>
          <p className="text-xs leading-5 text-muted-foreground">
              Share it now. This exact secure link is shown only once.
          </p>
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
              label={active ? "Regenerate link" : "Generate confirmation link"}
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
          Confirmation links can only be generated while the booking is draft or awaiting
          customer confirmation.
        </p>
      )}
    </div>
  );
}
