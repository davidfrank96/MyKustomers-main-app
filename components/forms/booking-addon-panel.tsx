"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  FileText,
  Inbox,
  Info,
  PackagePlus,
  PieChart,
  Plus,
  Send,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      className="border-destructive/30 text-destructive hover:bg-destructive/5"
      disabled={pending}
    >
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
    <li className="space-y-3 rounded-md border border-border p-3 sm:p-4">
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
          <p className="mt-2 text-sm tabular-nums">
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
        <div className="flex items-start gap-2 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Resolve the current customer agreement request before sending this draft.</p>
        </div>
      ) : null}
      {submitState.message ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {submitState.message}
        </p>
      ) : null}
      {cancelState.message ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {cancelState.message}
        </p>
      ) : null}
      {submitState.addonUrl && submitState.confirmationLinkId ? (
        <div className="space-y-3 rounded-md border border-primary/15 bg-primary/[0.025] p-3">
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

function CreateActions() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <DialogClose asChild>
        <Button type="button" variant="secondary" disabled={pending}>
          Cancel
        </Button>
      </DialogClose>
      <Button type="submit" disabled={pending}>
        <Plus className="size-4" aria-hidden="true" />
        {pending ? "Saving draft..." : "Save add-on draft"}
      </Button>
    </div>
  );
}

function FieldError({ state, name }: { state: AddonActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? (
    <p id={`addon-${name}-error`} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
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
    <div className="space-y-5">
      <dl className="grid gap-2.5 sm:grid-cols-3">
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/[0.07] text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-sm leading-5 text-muted-foreground">
              Current agreed value
            </dt>
            <dd className="mt-0.5 break-words text-lg font-semibold leading-6 tabular-nums [overflow-wrap:anywhere] sm:text-xl">
              {formatMoneyMinor(summary.totalAmountMinor, currency)}
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-border px-3 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/[0.07] text-primary">
            <WalletCards className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-sm leading-5 text-muted-foreground">
              Current deposit recorded
            </dt>
            <dd className="mt-0.5 break-words text-lg font-semibold leading-6 tabular-nums [overflow-wrap:anywhere] sm:text-xl">
              {formatMoneyMinor(summary.depositAmountMinor, currency)}
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-primary/20 bg-primary/[0.035] px-3 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/[0.09] text-primary">
            <PieChart className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-sm leading-5 text-muted-foreground">Current balance</dt>
            <dd className="mt-0.5 break-words text-lg font-semibold leading-6 text-primary tabular-nums [overflow-wrap:anywhere] sm:text-xl">
              {formatMoneyMinor(summary.balanceAmountMinor, currency)}
            </dd>
          </div>
        </div>
      </dl>

      <section
        className="border-t border-border pt-4"
        aria-labelledby="addon-value-heading"
      >
        <h3 id="addon-value-heading" className="text-base font-semibold leading-6">
          Value breakdown
        </h3>
        <dl className="mt-2 divide-y divide-border text-sm">
          <div className="flex min-w-0 justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Original booking</dt>
            <dd className="shrink-0 font-medium tabular-nums">
              {formatMoneyMinor(originalTotalAmountMinor, currency)}
            </dd>
          </div>
          {confirmed.map((addon) => (
            <div key={addon.id} className="flex min-w-0 justify-between gap-4 py-2.5">
              <dt className="min-w-0 break-words text-muted-foreground">{addon.title}</dt>
              <dd className="shrink-0 font-medium tabular-nums">
                {formatMoneyMinor(addon.total_amount_minor, currency)}
              </dd>
            </div>
          ))}
          <div className="flex min-w-0 justify-between gap-4 py-2.5 font-medium">
            <dt>Current agreed value</dt>
            <dd className="shrink-0 tabular-nums">
              {formatMoneyMinor(summary.totalAmountMinor, currency)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-start gap-2.5 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Original deposit recorded:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatMoneyMinor(originalDepositAmountMinor, currency)}
            </span>
            . Only confirmed add-ons contribute to current totals.
          </p>
        </div>
      </section>

      <section className="border-t border-border pt-4" aria-labelledby="addons-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 id="addons-heading" className="text-base font-semibold leading-6">
              Add-ons
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Additional scope shares this booking&apos;s delivery schedule.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="w-full border-primary/30 text-primary hover:bg-primary/[0.04] sm:w-auto"
                disabled={!canCreate || requestBlocked}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/[0.08] text-primary">
                    <PackagePlus className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle>Add item</DialogTitle>
                    <DialogDescription className="mt-1">
                      Create additional scope for the same booking and delivery. You will
                      review the draft before sending it to the customer.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <form action={createFormAction} className="mt-5 space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="addon-title">Title</Label>
                  <Input
                    id="addon-title"
                    name="title"
                    maxLength={160}
                    placeholder="e.g. Additional cupcakes"
                    required
                    aria-invalid={Boolean(createState.fieldErrors?.title)}
                    aria-describedby={
                      createState.fieldErrors?.title ? "addon-title-error" : undefined
                    }
                  />
                  <FieldError state={createState} name="title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addon-description">Description</Label>
                  <Textarea
                    id="addon-description"
                    name="description"
                    maxLength={5000}
                    placeholder="Describe the additional scope..."
                    className="min-h-24"
                    aria-invalid={Boolean(createState.fieldErrors?.description)}
                    aria-describedby={
                      createState.fieldErrors?.description
                        ? "addon-description-error"
                        : undefined
                    }
                  />
                  <FieldError state={createState} name="description" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="addon-total">Agreed amount</Label>
                    <Input
                      id="addon-total"
                      name="totalAmount"
                      inputMode="decimal"
                      placeholder="0.00"
                      required
                      aria-invalid={Boolean(createState.fieldErrors?.totalAmount)}
                      aria-describedby={
                        createState.fieldErrors?.totalAmount
                          ? "addon-totalAmount-error"
                          : undefined
                      }
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
                      aria-invalid={Boolean(createState.fieldErrors?.depositAmount)}
                      aria-describedby={
                        createState.fieldErrors?.depositAmount
                          ? "addon-depositAmount-error"
                          : undefined
                      }
                    />
                    <FieldError state={createState} name="depositAmount" />
                  </div>
                </div>
                {createState.message && createState.status === "error" ? (
                  <p
                    className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {createState.message}
                  </p>
                ) : null}
                <CreateActions />
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>
      {!canCreate ? (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-sm text-muted-foreground"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Add-ons are available only while a confirmed booking is confirmed or in
            progress.
          </p>
        </div>
      ) : requestBlocked ? (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-sm text-muted-foreground"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Resolve the current customer agreement request before adding another item.
          </p>
        </div>
      ) : null}

      {summary.items.length > 0 ? (
        <ol aria-label="Booking add-ons" className="space-y-3">
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
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
          <Inbox className="size-5 shrink-0" aria-hidden="true" />
          <p>No add-ons recorded.</p>
        </div>
      )}
    </div>
  );
}
