"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Send, XCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { CustomerConfirmationShare } from "@/components/forms/customer-confirmation-share";
import type { BookingAddonItem, BookingAddonSummary } from "@/features/addons/queries";
import {
  initialAddonActionState,
  type AddonActionState,
} from "@/features/addons/action-state";
import { buildAddonShareMessage, buildAddonShareTitle } from "@/features/addons/share";
import type { ConfirmationShareMethod } from "@/features/confirmation-links/share";
import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";

type AddonMutationAction = (
  addonId: string,
  previousState: AddonActionState,
  formData: FormData,
) => Promise<AddonActionState>;

type BookingAddonPanelProps = {
  summary: BookingAddonSummary;
  canCreate: boolean;
  requestBlocked: boolean;
  currency: BookingCurrency;
  originalTotalAmountMinor: number;
  originalDepositAmountMinor: number;
  businessName: string;
  customerName: string | null;
  createAction: (
    previousState: AddonActionState,
    formData: FormData,
  ) => Promise<AddonActionState>;
  submitAction: AddonMutationAction;
  cancelAction: AddonMutationAction;
  recordShareAction: (
    addonId: string,
    confirmationLinkId: string,
    method: ConfirmationShareMethod,
  ) => Promise<void>;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: BookingAddonItem["status"]) {
  if (status === "AWAITING_CUSTOMER") return "Awaiting customer";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CANCELLED") return "Cancelled";
  return "Draft";
}

function SubmitButton({
  replacement,
  disabled,
}: {
  replacement: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      <Send className="size-4" aria-hidden="true" />
      {pending
        ? "Preparing link..."
        : replacement
          ? "Replace secure link"
          : "Send for confirmation"}
    </Button>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      <XCircle className="size-4" aria-hidden="true" />
      {pending ? "Cancelling..." : "Cancel add-on"}
    </Button>
  );
}

function AddonRow({
  addon,
  currency,
  businessName,
  customerName,
  requestBlocked,
  submitAction,
  cancelAction,
  recordShareAction,
}: {
  addon: BookingAddonItem;
  currency: BookingCurrency;
  businessName: string;
  customerName: string | null;
  requestBlocked: boolean;
  submitAction: AddonMutationAction;
  cancelAction: AddonMutationAction;
  recordShareAction: BookingAddonPanelProps["recordShareAction"];
}) {
  const [submitState, submitFormAction] = useActionState(
    submitAction.bind(null, addon.id),
    initialAddonActionState,
  );
  const [cancelState, cancelFormAction] = useActionState(
    cancelAction.bind(null, addon.id),
    initialAddonActionState,
  );
  const canSubmit = addon.status === "DRAFT" || addon.status === "AWAITING_CUSTOMER";
  const hasSubmittedLink = addon.status === "AWAITING_CUSTOMER" && addon.latestLink;

  return (
    <li className="space-y-3 border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-medium">{addon.title}</p>
            <Badge variant={addon.status === "CONFIRMED" ? "default" : "outline"}>
              {statusLabel(addon.status)}
            </Badge>
          </div>
          {addon.description ? (
            <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
              {addon.description}
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            {formatMoneyMinor(addon.total_amount_minor, currency)} · Deposit recorded{" "}
            {formatMoneyMinor(addon.deposit_amount_minor, currency)}
          </p>
          {addon.status === "AWAITING_CUSTOMER" && addon.latestLink ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Expires {formatDate(addon.latestLink.expires_at)} · First viewed{" "}
              {formatDate(addon.latestLink.first_opened_at)}
            </p>
          ) : null}
          {addon.status === "CONFIRMED" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Confirmed {formatDate(addon.confirmed_at)} · Email{" "}
              {addon.confirmationEmailStatus?.toLowerCase() ?? "pending"}
            </p>
          ) : null}
        </div>
        {canSubmit ? (
          <div className="flex flex-wrap gap-2">
            <form action={submitFormAction}>
              <SubmitButton
                replacement={Boolean(hasSubmittedLink)}
                disabled={requestBlocked && addon.status === "DRAFT"}
              />
            </form>
            <form action={cancelFormAction}>
              <CancelButton />
            </form>
          </div>
        ) : null}
      </div>
      {requestBlocked && addon.status === "DRAFT" ? (
        <p className="text-sm text-muted-foreground">
          Resolve the current customer agreement request before sending this draft.
        </p>
      ) : null}
      {submitState.message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {submitState.message}
        </p>
      ) : null}
      {cancelState.message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {cancelState.message}
        </p>
      ) : null}
      {submitState.addonUrl && submitState.confirmationLinkId ? (
        <div className="space-y-3 border-y border-border py-3">
          <Label htmlFor={`addon-link-${addon.id}`}>Generated add-on link</Label>
          <Input id={`addon-link-${addon.id}`} value={submitState.addonUrl} readOnly />
          <CustomerConfirmationShare
            businessName={businessName}
            customerName={customerName}
            confirmationUrl={submitState.addonUrl}
            initialMessage={buildAddonShareMessage({ businessName, customerName })}
            shareTitle={buildAddonShareTitle(businessName)}
            triggerLabel="Share add-on"
            dialogTitle="Share add-on"
            linkLabel="Booking add-on link"
            recordShare={(method) =>
              recordShareAction(addon.id, submitState.confirmationLinkId!, method)
            }
            dialogDescription="Send the secure review request without including add-on details in the message."
            idPrefix={`addon-${addon.id}`}
          />
        </div>
      ) : null}
    </li>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      <Plus className="size-4" aria-hidden="true" />
      {pending ? "Saving draft..." : "Save add-on draft"}
    </Button>
  );
}

function FieldError({ state, name }: { state: AddonActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function BookingAddonPanel({
  summary,
  canCreate,
  requestBlocked,
  currency,
  originalTotalAmountMinor,
  originalDepositAmountMinor,
  businessName,
  customerName,
  createAction,
  submitAction,
  cancelAction,
  recordShareAction,
}: BookingAddonPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createState, createFormAction] = useActionState(
    async (previousState: AddonActionState, formData: FormData) => {
      const result = await createAction(previousState, formData);
      if (result.status === "success") setDialogOpen(false);
      return result;
    },
    initialAddonActionState,
  );
  const confirmed = summary.items.filter((addon) => addon.status === "CONFIRMED");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current agreed value
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoneyMinor(summary.totalAmountMinor, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current deposit recorded
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoneyMinor(summary.depositAmountMinor, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Current balance</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoneyMinor(summary.balanceAmountMinor, currency)}
          </p>
        </div>
      </div>

      <div className="border-y border-border py-4 text-sm">
        <p className="font-medium">Value breakdown</p>
        <div className="mt-3 flex justify-between gap-4">
          <span className="text-muted-foreground">Original booking</span>
          <span>{formatMoneyMinor(originalTotalAmountMinor, currency)}</span>
        </div>
        {confirmed.map((addon) => (
          <div key={addon.id} className="mt-2 flex justify-between gap-4">
            <span className="min-w-0 break-words text-muted-foreground">
              {addon.title}
            </span>
            <span>{formatMoneyMinor(addon.total_amount_minor, currency)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between gap-4 border-t border-border pt-3 font-medium">
          <span>Current agreed value</span>
          <span>{formatMoneyMinor(summary.totalAmountMinor, currency)}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Original deposit recorded:{" "}
          {formatMoneyMinor(originalDepositAmountMinor, currency)}. Only confirmed add-ons
          contribute to current totals.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Add-ons</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Additional scope shares this booking&apos;s delivery schedule.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              disabled={!canCreate || requestBlocked}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add item</DialogTitle>
              <DialogDescription>
                Create additional scope for the same booking and delivery. You will review
                the draft before sending it to the customer.
              </DialogDescription>
            </DialogHeader>
            <form action={createFormAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addon-title">Title</Label>
                <Input id="addon-title" name="title" maxLength={160} required />
                <FieldError state={createState} name="title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-description">Description</Label>
                <Textarea id="addon-description" name="description" maxLength={5000} />
                <FieldError state={createState} name="description" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="addon-total">Agreed amount</Label>
                  <Input
                    id="addon-total"
                    name="totalAmount"
                    inputMode="decimal"
                    required
                  />
                  <FieldError state={createState} name="totalAmount" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addon-deposit">Deposit recorded</Label>
                  <Input
                    id="addon-deposit"
                    name="depositAmount"
                    inputMode="decimal"
                    defaultValue="0"
                    required
                  />
                  <FieldError state={createState} name="depositAmount" />
                </div>
              </div>
              {createState.message && createState.status === "error" ? (
                <p className="text-sm text-destructive" role="status">
                  {createState.message}
                </p>
              ) : null}
              <CreateButton />
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!canCreate ? (
        <p className="text-sm text-muted-foreground">
          Add-ons are available only while a confirmed booking is confirmed or in
          progress.
        </p>
      ) : requestBlocked ? (
        <p className="text-sm text-muted-foreground">
          Resolve the current customer agreement request before adding another item.
        </p>
      ) : null}

      {summary.items.length > 0 ? (
        <ol aria-label="Booking add-ons">
          {summary.items.map((addon) => (
            <AddonRow
              key={addon.id}
              addon={addon}
              currency={currency}
              businessName={businessName}
              customerName={customerName}
              requestBlocked={requestBlocked}
              submitAction={submitAction}
              cancelAction={cancelAction}
              recordShareAction={recordShareAction}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No add-ons recorded.</p>
      )}
    </div>
  );
}
