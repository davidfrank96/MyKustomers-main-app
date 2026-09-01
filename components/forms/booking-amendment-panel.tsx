"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FilePenLine, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import type { BookingAmendmentSummary } from "@/features/amendments/queries";
import {
  initialAmendmentActionState,
  type AmendmentActionState,
} from "@/features/amendments/action-state";
import {
  amendmentFieldLabels,
  type AmendableBookingField,
} from "@/features/amendments/terms";
import {
  buildAmendmentShareMessage,
  buildAmendmentShareTitle,
} from "@/features/amendments/share";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";
import { bookingCurrencies, formatMoneyMinor } from "@/features/bookings/money";
import type { Json } from "@/types/database";

type BookingAmendmentPanelProps = {
  summary: BookingAmendmentSummary;
  canPropose: boolean;
  businessName: string;
  customerName: string | null;
  initialValues: {
    title: string;
    description: string | null;
    currency: (typeof bookingCurrencies)[number];
    totalAmount: string;
    depositAmount: string;
    scheduledFor: string | null;
  };
  createAction: (
    previousState: AmendmentActionState,
    formData: FormData,
  ) => Promise<AmendmentActionState>;
  revokeAction: (
    previousState: AmendmentActionState,
    formData: FormData,
  ) => Promise<AmendmentActionState>;
  recordShareAction: (
    amendmentId: string,
    method: ConfirmationShareMethod,
  ) => Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      <FilePenLine className="size-4" aria-hidden="true" />
      {pending ? "Creating request..." : "Send changes for confirmation"}
    </Button>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      <XCircle className="size-4" aria-hidden="true" />
      {pending ? "Revoking..." : "Revoke request"}
    </Button>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function snapshotValue(snapshot: Json, field: AmendableBookingField) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return "Unavailable";
  const raw = snapshot[field];
  const currency = typeof snapshot.currency === "string" ? snapshot.currency : "NGN";
  if (field === "scheduled_for") return formatDate(typeof raw === "string" ? raw : null);
  if (field === "total_amount_minor" || field === "deposit_amount_minor") {
    return typeof raw === "number"
      ? formatMoneyMinor(raw, currency as (typeof bookingCurrencies)[number])
      : "Unavailable";
  }
  if (field === "description")
    return typeof raw === "string" && raw ? raw : "Not provided";
  return typeof raw === "string" ? raw : "Unavailable";
}

function FieldError({ state, name }: { state: AmendmentActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function BookingAmendmentPanel({
  summary,
  canPropose,
  businessName,
  customerName,
  initialValues,
  createAction,
  revokeAction,
  recordShareAction,
}: BookingAmendmentPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [createState, createFormAction] = useActionState(
    async (previousState: AmendmentActionState, formData: FormData) => {
      const result = await createAction(previousState, formData);
      if (result.status === "success") setEditorOpen(false);
      return result;
    },
    initialAmendmentActionState,
  );
  const [revokeState, revokeFormAction] = useActionState(
    revokeAction,
    initialAmendmentActionState,
  );
  const pending = summary.displayStatus === "pending" && summary.latest;

  return (
    <div className="space-y-5">
      {pending ? (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Changes awaiting customer confirmation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatDate(pending.created_at)} · Expires{" "}
                {formatDate(pending.expires_at)}
              </p>
            </div>
            <form action={revokeFormAction}>
              <RevokeButton />
            </form>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Reason: {pending.reason}
          </p>
          <dl className="divide-y divide-border border-y border-border">
            {(pending.changed_fields as AmendableBookingField[]).map((field) => (
              <div key={field} className="grid gap-2 py-3 sm:grid-cols-[10rem_1fr_1fr]">
                <dt className="text-sm font-medium">{amendmentFieldLabels[field]}</dt>
                <dd className="min-w-0 break-words text-sm">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Current
                  </span>
                  {snapshotValue(pending.old_terms, field)}
                </dd>
                <dd className="min-w-0 break-words text-sm">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Proposed
                  </span>
                  {snapshotValue(pending.proposed_terms, field)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <p>
              Recipient:{" "}
              <span className="break-all text-muted-foreground">
                {pending.contact_email}
              </span>
            </p>
            <p>
              Request email:{" "}
              <span className="capitalize text-muted-foreground">
                {summary.requestEmailStatus?.toLowerCase() ?? "not queued"}
              </span>
            </p>
            <p>
              First viewed:{" "}
              <span className="text-muted-foreground">
                {formatDate(pending.first_opened_at)}
              </span>
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            The secure link is shown only when created. Revoke and replace this request if
            you need a new share link.
          </p>
        </div>
      ) : null}

      {summary.latest && summary.displayStatus !== "pending" ? (
        <p className="text-sm text-muted-foreground">
          Latest request: <span className="capitalize">{summary.displayStatus}</span>
          {summary.latest.confirmed_at
            ? ` · ${formatDate(summary.latest.confirmed_at)}`
            : ""}
          {summary.confirmationEmailStatus
            ? ` · Confirmation email ${summary.confirmationEmailStatus.toLowerCase()}`
            : ""}
        </p>
      ) : null}

      {createState.amendmentUrl && createState.amendmentId ? (
        <div className="space-y-3 border-y border-border py-4">
          <p className="text-sm font-medium">Secure booking change request ready</p>
          <input
            className="sr-only"
            readOnly
            aria-label="Generated amendment link"
            value={createState.amendmentUrl}
          />
          <CustomerConfirmationShare
            businessName={businessName}
            customerName={customerName}
            confirmationUrl={createState.amendmentUrl}
            recordShare={recordShareAction.bind(null, createState.amendmentId)}
            initialMessage={buildAmendmentShareMessage({ businessName, customerName })}
            shareTitle={buildAmendmentShareTitle(businessName)}
            triggerLabel="Share booking changes"
            dialogTitle="Share booking changes"
            dialogDescription="Send the secure review request without including booking details in the message."
            linkLabel="Booking change link"
            idPrefix="amendment"
          />
        </div>
      ) : null}

      {createState.message ? (
        <p className="text-sm text-muted-foreground">{createState.message}</p>
      ) : null}
      {revokeState.message ? (
        <p className="text-sm text-muted-foreground">{revokeState.message}</p>
      ) : null}

      {canPropose ? (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant={pending ? "secondary" : "primary"}>
              <FilePenLine className="size-4" aria-hidden="true" />
              {pending ? "Replace proposed changes" : "Propose change"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Propose booking changes</DialogTitle>
              <DialogDescription>
                Current booking terms remain effective until the customer confirms.
              </DialogDescription>
            </DialogHeader>
            <form action={createFormAction} className="mt-5 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="amendment-reason">Reason for changes</Label>
                <Textarea id="amendment-reason" name="reason" maxLength={500} required />
                <FieldError state={createState} name="reason" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="amendment-title">Proposed booking title</Label>
                  <p className="text-xs text-muted-foreground">
                    Current: {initialValues.title}
                  </p>
                  <Input
                    id="amendment-title"
                    name="title"
                    defaultValue={initialValues.title}
                    required
                  />
                  <FieldError state={createState} name="title" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="amendment-description">Proposed details</Label>
                  <p className="break-words text-xs text-muted-foreground">
                    Current: {initialValues.description || "Not provided"}
                  </p>
                  <Textarea
                    id="amendment-description"
                    name="description"
                    defaultValue={initialValues.description ?? ""}
                    className="min-h-28"
                  />
                  <FieldError state={createState} name="description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amendment-currency">Proposed currency</Label>
                  <p className="text-xs text-muted-foreground">
                    Current: {initialValues.currency}
                  </p>
                  <select
                    id="amendment-currency"
                    name="currency"
                    defaultValue={initialValues.currency}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {bookingCurrencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amendment-scheduled">Proposed date and time</Label>
                  <p className="text-xs text-muted-foreground">
                    Current: {formatDate(initialValues.scheduledFor)}
                  </p>
                  <Input
                    id="amendment-scheduled"
                    name="scheduledFor"
                    type="datetime-local"
                    defaultValue={localDateTime(initialValues.scheduledFor)}
                  />
                  <FieldError state={createState} name="scheduledFor" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amendment-total">Proposed agreed total</Label>
                  <p className="text-xs text-muted-foreground">
                    Current: {initialValues.totalAmount}
                  </p>
                  <Input
                    id="amendment-total"
                    name="totalAmount"
                    inputMode="decimal"
                    defaultValue={initialValues.totalAmount}
                    required
                  />
                  <FieldError state={createState} name="totalAmount" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amendment-deposit">Proposed deposit recorded</Label>
                  <p className="text-xs text-muted-foreground">
                    Current: {initialValues.depositAmount}
                  </p>
                  <Input
                    id="amendment-deposit"
                    name="depositAmount"
                    inputMode="decimal"
                    defaultValue={initialValues.depositAmount}
                    required
                  />
                  <FieldError state={createState} name="depositAmount" />
                </div>
              </div>
              <SubmitButton />
            </form>
          </DialogContent>
        </Dialog>
      ) : (
        <div
          role="note"
          className="rounded-md border border-primary/15 bg-primary/[0.035] p-3 sm:p-4"
        >
          <div className="flex items-start gap-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary"
              aria-hidden="true"
            >
              <Info className="size-4" />
            </span>
            <p className="min-w-0 pt-1 text-sm leading-6 text-muted-foreground">
              Booking changes can be proposed only while a confirmed booking is confirmed
              or in progress.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
