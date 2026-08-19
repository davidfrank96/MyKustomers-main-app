"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Link2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConfirmationLinkSummary } from "@/features/confirmation-links/queries";
import {
  initialConfirmationLinkActionState,
  type ConfirmationLinkActionState,
} from "@/features/confirmation-links/action-state";

type ConfirmationLinkPanelProps = {
  summary: ConfirmationLinkSummary;
  canManage: boolean;
  generateAction: (
    previousState: ConfirmationLinkActionState,
    formData: FormData,
  ) => Promise<ConfirmationLinkActionState>;
  revokeAction: (
    previousState: ConfirmationLinkActionState,
    formData: FormData,
  ) => Promise<ConfirmationLinkActionState>;
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
  generateAction,
  revokeAction,
}: ConfirmationLinkPanelProps) {
  const [generateState, generateFormAction] = useActionState(
    generateAction,
    initialConfirmationLinkActionState,
  );
  const [revokeState, revokeFormAction] = useActionState(
    revokeAction,
    initialConfirmationLinkActionState,
  );
  const [copied, setCopied] = useState(false);
  const active = summary.status === "active";
  const generatedUrl = generateState.confirmationUrl;

  async function copyGeneratedUrl() {
    if (!generatedUrl) {
      return;
    }

    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {generatedUrl ? (
        <div className="space-y-2 rounded-md border border-border bg-muted p-3">
          <p className="text-sm font-medium">Copy this link now.</p>
          <p className="text-xs leading-5 text-muted-foreground">
            The raw token is shown only immediately after generation.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={generatedUrl}
              className="min-h-11 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
              aria-label="Generated confirmation link"
            />
            <Button type="button" variant="secondary" onClick={copyGeneratedUrl}>
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
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
