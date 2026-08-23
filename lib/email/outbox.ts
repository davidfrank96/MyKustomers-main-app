import "server-only";
import { z } from "zod";
import { bookingCurrencies } from "@/features/bookings/money";
import { deriveEffectiveBookingTotals } from "@/features/addons/totals";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";
import {
  bookingAmendmentConfirmedEmail,
  bookingAmendmentRequestedEmail,
} from "@/lib/email/templates/booking-amendment";
import {
  bookingCancelledEmail,
  selectCancellationRecipient,
} from "@/lib/email/templates/booking-cancelled";
import {
  bookingAddonConfirmedEmail,
  bookingAddonRequestedEmail,
} from "@/lib/email/templates/booking-addon";
import { getTransactionalEmailProvider } from "@/lib/email/provider";
import { sendWithProviderBoundary } from "@/lib/email/send";
import type {
  TransactionalEmailMessage,
  TransactionalEmailProvider,
} from "@/lib/email/types";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";

const bookingSnapshotSchema = z.object({
  business_name: z.string().min(1),
  booking_reference: z.string().min(1),
  title: z.string().min(1),
  scheduled_for: z.string().nullable().optional(),
  currency: z.enum(bookingCurrencies),
  total_amount_minor: z.number().int().nonnegative(),
  deposit_amount_minor: z.number().int().nonnegative(),
  balance_amount_minor: z.number().int().nonnegative(),
});

const cancelledBookingSchema = z.object({
  status: z.literal("CANCELLED"),
  cancellation_reason: z.string().min(1).max(500),
  cancelled_at: z.string().datetime({ offset: true }),
});

const amendmentTermsSchema = bookingSnapshotSchema.extend({
  customer_name: z.string().min(1),
  description: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  scheduled_for: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

const amendmentSchema = z.object({
  reason: z.string().min(1).max(500),
  contact_email: z.string().email(),
  changed_fields: z.array(
    z.enum([
      "title",
      "description",
      "currency",
      "total_amount_minor",
      "deposit_amount_minor",
      "scheduled_for",
    ]),
  ),
  old_terms: amendmentTermsSchema,
  proposed_terms: amendmentTermsSchema,
});

const addonSnapshotSchema = z.object({
  business_name: z.string().min(1),
  booking_reference: z.string().min(1),
  booking_title: z.string().min(1),
  inherited_scheduled_for: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  currency: z.enum(bookingCurrencies),
  total_amount_minor: z.number().int().nonnegative(),
  deposit_amount_minor: z.number().int().nonnegative(),
  balance_amount_minor: z.number().int().nonnegative(),
});

const addonSchema = z.object({
  confirmation_contact_email: z.string().email(),
  terms_snapshot: addonSnapshotSchema,
  status: z.enum(["AWAITING_CUSTOMER", "CONFIRMED"]),
});

type EmailDeliveryContext = { amendmentUrl?: string; addonUrl?: string };

async function failEmailEvent({
  emailEventId,
  code,
  message,
}: {
  emailEventId: string;
  code: string;
  message: string;
}) {
  const supabase = createServiceRoleClient();
  await supabase
    .from("email_events")
    .update({
      status: "FAILED",
      failure_code: code.slice(0, 80),
      failure_message: message.slice(0, 500),
    })
    .eq("id", emailEventId)
    .eq("status", "SENDING");

  return { status: "failed", code } as const;
}

export type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "failed"; code: string }
  | { status: "skipped"; reason: "service-role-unavailable" | "not-claimable" };

export async function deliverEmailEvent(
  emailEventId: string,
  provider: TransactionalEmailProvider = getTransactionalEmailProvider(),
  context: EmailDeliveryContext = {},
): Promise<EmailDeliveryResult> {
  if (!canUseServiceRoleClient()) {
    return { status: "skipped", reason: "service-role-unavailable" };
  }

  const supabase = createServiceRoleClient();
  const { data: claimedEvents, error: claimError } = await supabase.rpc(
    "claim_email_event",
    { p_email_event_id: emailEventId },
  );
  const event = claimedEvents?.[0];

  if (claimError || !event) {
    return { status: "skipped", reason: "not-claimable" };
  }

  let message: TransactionalEmailMessage;

  if (
    event.event_type === "BOOKING_ADDON_REQUESTED" ||
    event.event_type === "BOOKING_ADDON_CONFIRMED"
  ) {
    if (!event.booking_addon_id) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_addon_event",
        message: "The booking add-on email data is unavailable.",
      });
    }
    const { data: addon, error: addonError } = await supabase
      .from("booking_addons")
      .select("confirmation_contact_email, terms_snapshot, status")
      .eq("id", event.booking_addon_id)
      .eq("business_id", event.business_id)
      .eq("booking_id", event.booking_id)
      .maybeSingle();
    const parsed = addonSchema.safeParse(addon);
    if (
      addonError ||
      !parsed.success ||
      parsed.data.confirmation_contact_email !== event.recipient_email
    ) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_addon_event",
        message: "The booking add-on email data is unavailable.",
      });
    }
    const snapshot = parsed.data.terms_snapshot;
    const baseInput = {
      emailEventId: event.id,
      recipientEmail: event.recipient_email,
      businessName: snapshot.business_name,
      bookingReference: snapshot.booking_reference,
    };

    if (event.event_type === "BOOKING_ADDON_REQUESTED") {
      let addonUrl: URL;
      try {
        addonUrl = new URL(context.addonUrl ?? "");
      } catch {
        return failEmailEvent({
          emailEventId: event.id,
          code: "addon_url_unavailable",
          message: "The secure booking add-on URL is unavailable.",
        });
      }
      if (!addonUrl.pathname.startsWith("/x/")) {
        return failEmailEvent({
          emailEventId: event.id,
          code: "addon_url_invalid",
          message: "The secure booking add-on URL is invalid.",
        });
      }
      message = bookingAddonRequestedEmail({
        ...baseInput,
        addonUrl: addonUrl.toString(),
      });
    } else {
      const [{ data: booking }, { data: confirmedAddons }] = await Promise.all([
        supabase
          .from("bookings")
          .select("currency, total_amount_minor, deposit_amount_minor, scheduled_for")
          .eq("id", event.booking_id)
          .eq("business_id", event.business_id)
          .maybeSingle(),
        supabase
          .from("booking_addons")
          .select("status, total_amount_minor, deposit_amount_minor")
          .eq("business_id", event.business_id)
          .eq("booking_id", event.booking_id)
          .eq("status", "CONFIRMED"),
      ]);
      if (!booking || booking.currency !== snapshot.currency) {
        return failEmailEvent({
          emailEventId: event.id,
          code: "invalid_addon_event",
          message: "The booking add-on totals are unavailable.",
        });
      }
      const currentTotals = deriveEffectiveBookingTotals(booking, confirmedAddons ?? []);
      message = bookingAddonConfirmedEmail({
        ...baseInput,
        addonTitle: snapshot.title,
        scheduledFor: booking.scheduled_for,
        currency: snapshot.currency,
        addonTotalAmountMinor: snapshot.total_amount_minor,
        addonDepositAmountMinor: snapshot.deposit_amount_minor,
        currentTotalAmountMinor: currentTotals.totalAmountMinor,
        currentDepositAmountMinor: currentTotals.depositAmountMinor,
      });
    }
  } else if (
    event.event_type === "BOOKING_AMENDMENT_REQUESTED" ||
    event.event_type === "BOOKING_AMENDMENT_CONFIRMED"
  ) {
    if (!event.booking_amendment_id) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_amendment_event",
        message: "The booking amendment email data is unavailable.",
      });
    }

    const { data: amendment, error: amendmentError } = await supabase
      .from("booking_amendments")
      .select("reason, contact_email, changed_fields, old_terms, proposed_terms")
      .eq("id", event.booking_amendment_id)
      .eq("business_id", event.business_id)
      .eq("booking_id", event.booking_id)
      .maybeSingle();
    const parsed = amendmentSchema.safeParse(amendment);

    if (
      amendmentError ||
      !parsed.success ||
      parsed.data.contact_email !== event.recipient_email
    ) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_amendment_event",
        message: "The booking amendment email data is unavailable.",
      });
    }

    const input = {
      emailEventId: event.id,
      recipientEmail: event.recipient_email,
      businessName: parsed.data.old_terms.business_name,
      bookingReference: parsed.data.old_terms.booking_reference,
      reason: parsed.data.reason,
      changedFields: parsed.data.changed_fields,
      oldTerms: parsed.data.old_terms,
      proposedTerms: parsed.data.proposed_terms,
    };

    if (event.event_type === "BOOKING_AMENDMENT_REQUESTED") {
      let amendmentUrl: URL;
      try {
        amendmentUrl = new URL(context.amendmentUrl ?? "");
      } catch {
        return failEmailEvent({
          emailEventId: event.id,
          code: "amendment_url_unavailable",
          message: "The secure booking amendment URL is unavailable.",
        });
      }
      if (!amendmentUrl.pathname.startsWith("/a/")) {
        return failEmailEvent({
          emailEventId: event.id,
          code: "amendment_url_invalid",
          message: "The secure booking amendment URL is invalid.",
        });
      }
      message = bookingAmendmentRequestedEmail({
        ...input,
        amendmentUrl: amendmentUrl.toString(),
      });
    } else {
      message = bookingAmendmentConfirmedEmail(input);
    }
  } else {
    if (!event.booking_confirmation_id) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_confirmation_event",
        message: "The booking confirmation email data is unavailable.",
      });
    }

    const { data: confirmation, error: confirmationError } = await supabase
      .from("booking_confirmations")
      .select("terms_snapshot, contact_email")
      .eq("id", event.booking_confirmation_id)
      .eq("business_id", event.business_id)
      .eq("booking_id", event.booking_id)
      .maybeSingle();
    const snapshot = bookingSnapshotSchema.safeParse(confirmation?.terms_snapshot);

    if (confirmationError || !snapshot.success) {
      return failEmailEvent({
        emailEventId: event.id,
        code: "invalid_confirmation_snapshot",
        message: "The booking confirmation email data is unavailable.",
      });
    }

    if (event.event_type === "BOOKING_CONFIRMED") {
      message = bookingConfirmedEmail({
        emailEventId: event.id,
        recipientEmail: event.recipient_email,
        businessName: snapshot.data.business_name,
        bookingTitle: snapshot.data.title,
        bookingReference: snapshot.data.booking_reference,
        scheduledFor: snapshot.data.scheduled_for ?? null,
        currency: snapshot.data.currency,
        totalAmountMinor: snapshot.data.total_amount_minor,
        depositAmountMinor: snapshot.data.deposit_amount_minor,
        balanceAmountMinor: snapshot.data.balance_amount_minor,
      });
    } else {
      const { data: latestAmendment } = await supabase
        .from("booking_amendments")
        .select("effective_terms")
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .eq("status", "CONFIRMED")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const effectiveSnapshot = bookingSnapshotSchema.safeParse(
        latestAmendment?.effective_terms,
      );
      const cancellationSnapshot = effectiveSnapshot.success
        ? effectiveSnapshot.data
        : snapshot.data;
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("status, cancellation_reason, cancelled_at")
        .eq("id", event.booking_id)
        .eq("business_id", event.business_id)
        .maybeSingle();
      const cancelledBooking = cancelledBookingSchema.safeParse(booking);
      const authoritativeRecipient = selectCancellationRecipient({
        confirmationContactEmail: confirmation?.contact_email ?? null,
        customerEmail: event.recipient_email,
      });

      if (
        bookingError ||
        !cancelledBooking.success ||
        authoritativeRecipient !== event.recipient_email
      ) {
        return failEmailEvent({
          emailEventId: event.id,
          code: "invalid_cancellation_event",
          message: "The booking cancellation email data is unavailable.",
        });
      }

      message = bookingCancelledEmail({
        emailEventId: event.id,
        recipientEmail: authoritativeRecipient,
        businessName: cancellationSnapshot.business_name,
        bookingTitle: cancellationSnapshot.title,
        bookingReference: cancellationSnapshot.booking_reference,
        scheduledFor: cancellationSnapshot.scheduled_for ?? null,
        cancellationReason: cancelledBooking.data.cancellation_reason,
        cancelledAt: cancelledBooking.data.cancelled_at,
      });
    }
  }

  const result = await sendWithProviderBoundary(provider, message);

  if (result.status === "sent") {
    const { error } = await supabase
      .from("email_events")
      .update({
        status: "SENT",
        provider_message_id: result.messageId.slice(0, 255),
        sent_at: new Date().toISOString(),
        failure_code: null,
        failure_message: null,
      })
      .eq("id", event.id)
      .eq("status", "SENDING");

    return error
      ? { status: "failed", code: "delivery_state_update_failed" }
      : { status: "sent" };
  }

  await supabase
    .from("email_events")
    .update({
      status: "FAILED",
      failure_code: result.code.slice(0, 80),
      failure_message: result.message.slice(0, 500),
    })
    .eq("id", event.id)
    .eq("status", "SENDING");

  return { status: "failed", code: result.code };
}
