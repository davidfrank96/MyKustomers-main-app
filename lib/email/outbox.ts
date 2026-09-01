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
import { bookingDeliveredEmail } from "@/lib/email/templates/booking-delivered";
import { bookingRescheduledEmail } from "@/lib/email/templates/booking-rescheduled";
import { bookingConfirmationRequestedEmail } from "@/lib/email/templates/booking-confirmation-requested";
import { applyBookingEmailThreading } from "@/lib/email/threading";
import { publicEnv } from "@/lib/config/public-env";
import { getTransactionalEmailProvider } from "@/lib/email/provider";
import { sendWithProviderBoundary } from "@/lib/email/send";
import { buildEmailAttemptIdempotencyKey } from "@/lib/email/retry-policy";
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

const confirmationRequestBookingSchema = z.object({
  title: z.string().min(1),
  reference: z.string().min(1),
  scheduled_for: z.string().nullable(),
});

const cancelledBookingSchema = z.object({
  status: z.literal("CANCELLED"),
  cancellation_reason: z.string().min(1).max(500),
  cancelled_at: z.string().datetime({ offset: true }),
});

const deliveredBookingSchema = z.object({
  status: z.enum(["DELIVERED", "COMPLETED"]),
  delivered_at: z.string().datetime({ offset: true }),
});

const deliveryDispatchContextSchema = z.object({
  email_event_id: z.string().uuid(),
  business_id: z.string().uuid(),
  booking_id: z.string().uuid(),
  recipient_email: z.string().email(),
  feedback_link_id: z.string().uuid(),
  feedback_token: z.string().min(1),
  expires_at: z.string().datetime({ offset: true }),
  booking_status: z.enum(["DELIVERED", "COMPLETED"]),
});

const rescheduleChangeSchema = z.object({
  change_type: z.literal("reschedule"),
  previous_scheduled_for: z.string().datetime({ offset: true }).nullable(),
  new_scheduled_for: z.string().datetime({ offset: true }),
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

type EmailDeliveryContext = {
  amendmentUrl?: string;
  addonUrl?: string;
  confirmationUrl?: string;
};

type BookingThreadContext = {
  businessName: string;
  bookingReference: string;
};

async function failEmailEvent({
  emailEventId,
  attemptId,
  code,
  message,
}: {
  emailEventId: string;
  attemptId: string | null;
  code: string;
  message: string;
}) {
  const supabase = createServiceRoleClient();
  if (!attemptId) {
    const { error } = await supabase
      .from("email_events")
      .update({
        status: "FAILED",
        failure_code: code.slice(0, 80),
        failure_message: message.slice(0, 500),
      })
      .eq("id", emailEventId)
      .eq("status", "SENDING");

    return {
      status: "failed",
      code: error ? "delivery_state_update_failed" : code,
    } as const;
  }

  const { data: finalized, error } = await supabase.rpc(
    "finalize_email_delivery_attempt",
    {
      p_email_event_id: emailEventId,
      p_attempt_id: attemptId,
      p_result: "FAILED",
      p_failure_code: code,
      p_failure_message: message,
    },
  );

  return {
    status: "failed",
    code: error || !finalized ? "delivery_state_update_failed" : code,
  } as const;
}

export type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "failed"; code: string }
  | { status: "skipped"; reason: "service-role-unavailable" | "not-claimable" };

function persistedProviderName(provider: TransactionalEmailProvider) {
  return provider.name === "development" ||
    provider.name === "brevo" ||
    provider.name === "resend"
    ? provider.name
    : "unknown";
}

function deliveryDispatchFailureCode(message: string | undefined) {
  const knownCodes = [
    "delivery_event_retry_horizon_elapsed",
    "delivery_feedback_capability_expired",
    "delivery_feedback_capability_revoked",
    "delivery_feedback_capability_integrity_failure",
    "delivery_feedback_capability_unavailable",
    "delivery_feedback_association_unavailable",
    "delivery_booking_state_unavailable",
  ] as const;

  return (
    knownCodes.find((code) => message?.includes(code)) ??
    "invalid_delivery_feedback_context"
  );
}

export async function deliverEmailEvent(
  emailEventId: string,
  provider: TransactionalEmailProvider = getTransactionalEmailProvider(),
  context: EmailDeliveryContext = {},
): Promise<EmailDeliveryResult> {
  if (!canUseServiceRoleClient()) {
    return { status: "skipped", reason: "service-role-unavailable" };
  }

  const supabase = createServiceRoleClient();
  let { data: claimedEvents, error: claimError } = await supabase.rpc(
    "claim_email_event",
    {
      p_email_event_id: emailEventId,
      p_provider: persistedProviderName(provider),
    },
  );

  let legacyClaim = false;
  if (claimError?.code === "PGRST202") {
    const legacyResult = await supabase.rpc("claim_email_event", {
      p_email_event_id: emailEventId,
    });
    claimedEvents = legacyResult.data;
    claimError = legacyResult.error;
    legacyClaim = true;
  }

  const event = claimedEvents?.[0];

  if (claimError || !event) {
    return { status: "skipped", reason: "not-claimable" };
  }

  if (legacyClaim) {
    return deliverClaimedEmailEvent({
      emailEventId: event.id,
      attemptId: null,
      provider,
      context,
    });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("email_delivery_attempts")
    .select("id")
    .eq("email_event_id", event.id)
    .eq("attempt_number", event.attempt_count)
    .maybeSingle();

  if (attemptError || !attempt) {
    return { status: "failed", code: "delivery_state_update_failed" };
  }

  return deliverClaimedEmailEvent({
    emailEventId: event.id,
    attemptId: attempt.id,
    provider,
    context,
  });
}

export async function deliverClaimedEmailEvent({
  emailEventId,
  attemptId,
  provider,
  context = {},
}: {
  emailEventId: string;
  attemptId: string | null;
  provider: TransactionalEmailProvider;
  context?: EmailDeliveryContext;
}): Promise<EmailDeliveryResult> {
  if (!canUseServiceRoleClient()) {
    return { status: "skipped", reason: "service-role-unavailable" };
  }

  const supabase = createServiceRoleClient();
  const { data: event } = await supabase
    .from("email_events")
    .select("*")
    .eq("id", emailEventId)
    .eq("status", "SENDING")
    .maybeSingle();
  const { data: persistedAttempt } = attemptId
    ? await supabase
        .from("email_delivery_attempts")
        .select("id, attempt_number, provider, status")
        .eq("id", attemptId)
        .eq("email_event_id", emailEventId)
        .eq("status", "SENDING")
        .maybeSingle()
    : { data: null };
  const attempt =
    persistedAttempt ??
    (event && !attemptId
      ? {
          id: null,
          attempt_number: event.attempt_count,
          provider: persistedProviderName(provider),
          status: "SENDING" as const,
        }
      : null);

  if (
    !event ||
    !attempt ||
    attempt.attempt_number !== event.attempt_count ||
    attempt.provider !== persistedProviderName(provider)
  ) {
    return { status: "skipped", reason: "not-claimable" };
  }

  const failClaimedEmailEvent = (failure: { code: string; message: string }) =>
    failEmailEvent({
      emailEventId: event.id,
      attemptId,
      ...failure,
    });

  let message: TransactionalEmailMessage;
  let threadContext: BookingThreadContext | null = null;

  if (event.event_type === "BOOKING_CONFIRMATION_REQUESTED") {
    if (!event.confirmation_link_id) {
      return failClaimedEmailEvent({
        code: "invalid_confirmation_request_event",
        message: "The booking confirmation request data is unavailable.",
      });
    }

    const [{ data: link }, { data: booking }, { data: business }] = await Promise.all([
      supabase
        .from("confirmation_links")
        .select("id, used_at, revoked_at, expires_at")
        .eq("id", event.confirmation_link_id)
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("title, reference, scheduled_for")
        .eq("id", event.booking_id)
        .eq("business_id", event.business_id)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("name")
        .eq("id", event.business_id)
        .maybeSingle(),
    ]);
    const parsedBooking = confirmationRequestBookingSchema.safeParse(booking);

    if (
      !link ||
      !parsedBooking.success ||
      !business?.name ||
      link.used_at ||
      link.revoked_at ||
      new Date(link.expires_at).getTime() <= Date.now()
    ) {
      return failClaimedEmailEvent({
        code: "invalid_confirmation_request_event",
        message: "The booking confirmation request data is unavailable.",
      });
    }

    let confirmationUrl: URL;
    try {
      confirmationUrl = new URL(context.confirmationUrl ?? "");
    } catch {
      return failClaimedEmailEvent({
        code: "confirmation_url_unavailable",
        message: "The secure booking confirmation URL is unavailable.",
      });
    }
    if (!confirmationUrl.pathname.startsWith("/c/")) {
      return failClaimedEmailEvent({
        code: "confirmation_url_invalid",
        message: "The secure booking confirmation URL is invalid.",
      });
    }

    const requestBooking = parsedBooking.data;
    threadContext = {
      businessName: business.name,
      bookingReference: requestBooking.reference,
    };
    message = bookingConfirmationRequestedEmail({
      emailEventId: event.id,
      recipientEmail: event.recipient_email,
      businessName: business.name,
      bookingTitle: requestBooking.title,
      bookingReference: requestBooking.reference,
      scheduledFor: requestBooking.scheduled_for,
      confirmationUrl: confirmationUrl.toString(),
    });
  } else if (
    event.event_type === "BOOKING_ADDON_REQUESTED" ||
    event.event_type === "BOOKING_ADDON_CONFIRMED"
  ) {
    if (!event.booking_addon_id) {
      return failClaimedEmailEvent({
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
      return failClaimedEmailEvent({
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
    threadContext = {
      businessName: snapshot.business_name,
      bookingReference: snapshot.booking_reference,
    };

    if (event.event_type === "BOOKING_ADDON_REQUESTED") {
      let addonUrl: URL;
      try {
        addonUrl = new URL(context.addonUrl ?? "");
      } catch {
        return failClaimedEmailEvent({
          code: "addon_url_unavailable",
          message: "The secure booking add-on URL is unavailable.",
        });
      }
      if (!addonUrl.pathname.startsWith("/x/")) {
        return failClaimedEmailEvent({
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
        return failClaimedEmailEvent({
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
      return failClaimedEmailEvent({
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
      return failClaimedEmailEvent({
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
    threadContext = {
      businessName: parsed.data.old_terms.business_name,
      bookingReference: parsed.data.old_terms.booking_reference,
    };

    if (event.event_type === "BOOKING_AMENDMENT_REQUESTED") {
      let amendmentUrl: URL;
      try {
        amendmentUrl = new URL(context.amendmentUrl ?? "");
      } catch {
        return failClaimedEmailEvent({
          code: "amendment_url_unavailable",
          message: "The secure booking amendment URL is unavailable.",
        });
      }
      if (!amendmentUrl.pathname.startsWith("/a/")) {
        return failClaimedEmailEvent({
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
  } else if (event.event_type === "BOOKING_RESCHEDULED") {
    if (!event.booking_change_id || !event.confirmation_link_id) {
      return failClaimedEmailEvent({
        code: "invalid_reschedule_event",
        message: "The booking reschedule email data is unavailable.",
      });
    }

    const [{ data: change }, { data: link }, { data: confirmation }] = await Promise.all([
      supabase
        .from("booking_changes")
        .select("change_type, previous_scheduled_for, new_scheduled_for")
        .eq("id", event.booking_change_id)
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .maybeSingle(),
      supabase
        .from("confirmation_links")
        .select("id, used_at, revoked_at, expires_at")
        .eq("id", event.confirmation_link_id)
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .maybeSingle(),
      supabase
        .from("booking_confirmations")
        .select("terms_snapshot, contact_email")
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const parsedChange = rescheduleChangeSchema.safeParse(change);
    const snapshot = bookingSnapshotSchema.safeParse(confirmation?.terms_snapshot);
    const authoritativeRecipient = selectCancellationRecipient({
      confirmationContactEmail: confirmation?.contact_email ?? null,
      customerEmail: event.recipient_email,
    });

    if (
      !parsedChange.success ||
      !snapshot.success ||
      !link ||
      link.used_at ||
      link.revoked_at ||
      new Date(link.expires_at).getTime() <= Date.now() ||
      authoritativeRecipient !== event.recipient_email
    ) {
      return failClaimedEmailEvent({
        code: "invalid_reschedule_event",
        message: "The booking reschedule email data is unavailable.",
      });
    }

    let confirmationUrl: URL;
    try {
      confirmationUrl = new URL(context.confirmationUrl ?? "");
    } catch {
      return failClaimedEmailEvent({
        code: "confirmation_url_unavailable",
        message: "The secure booking confirmation URL is unavailable.",
      });
    }
    if (!confirmationUrl.pathname.startsWith("/c/")) {
      return failClaimedEmailEvent({
        code: "confirmation_url_invalid",
        message: "The secure booking confirmation URL is invalid.",
      });
    }

    threadContext = {
      businessName: snapshot.data.business_name,
      bookingReference: snapshot.data.booking_reference,
    };
    message = bookingRescheduledEmail({
      emailEventId: event.id,
      recipientEmail: authoritativeRecipient,
      businessName: snapshot.data.business_name,
      bookingTitle: snapshot.data.title,
      bookingReference: snapshot.data.booking_reference,
      previousScheduledFor: parsedChange.data.previous_scheduled_for,
      scheduledFor: parsedChange.data.new_scheduled_for,
      confirmationUrl: confirmationUrl.toString(),
    });
  } else if (
    event.event_type === "BOOKING_CONFIRMED" ||
    event.event_type === "BOOKING_CANCELLED" ||
    event.event_type === "BOOKING_DELIVERED"
  ) {
    if (!event.booking_confirmation_id) {
      return failClaimedEmailEvent({
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
      return failClaimedEmailEvent({
        code: "invalid_confirmation_snapshot",
        message: "The booking confirmation email data is unavailable.",
      });
    }

    threadContext = {
      businessName: snapshot.data.business_name,
      bookingReference: snapshot.data.booking_reference,
    };

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
    } else if (event.event_type === "BOOKING_CANCELLED") {
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
        return failClaimedEmailEvent({
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
    } else {
      const [
        { data: dispatchRows, error: dispatchError },
        { data: latestAmendment },
        { data: booking, error: bookingError },
      ] = await Promise.all([
        supabase.rpc("get_delivery_feedback_dispatch_context", {
          p_email_event_id: event.id,
        }),
        supabase
          .from("booking_amendments")
          .select("effective_terms")
          .eq("business_id", event.business_id)
          .eq("booking_id", event.booking_id)
          .eq("status", "CONFIRMED")
          .order("confirmed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("status, delivered_at")
          .eq("id", event.booking_id)
          .eq("business_id", event.business_id)
          .maybeSingle(),
      ]);
      const dispatchContext = deliveryDispatchContextSchema.safeParse(dispatchRows?.[0]);
      const effectiveSnapshot = bookingSnapshotSchema.safeParse(
        latestAmendment?.effective_terms,
      );
      const deliverySnapshot = effectiveSnapshot.success
        ? effectiveSnapshot.data
        : snapshot.data;
      const deliveredBooking = deliveredBookingSchema.safeParse(booking);
      const authoritativeRecipient = selectCancellationRecipient({
        confirmationContactEmail: confirmation?.contact_email ?? null,
        customerEmail: event.recipient_email,
      });

      if (
        dispatchError ||
        !dispatchContext.success ||
        bookingError ||
        !deliveredBooking.success ||
        authoritativeRecipient !== event.recipient_email ||
        dispatchContext.data.email_event_id !== event.id ||
        dispatchContext.data.business_id !== event.business_id ||
        dispatchContext.data.booking_id !== event.booking_id ||
        dispatchContext.data.recipient_email !== event.recipient_email ||
        dispatchContext.data.booking_status !== deliveredBooking.data.status
      ) {
        return failClaimedEmailEvent({
          code: dispatchError
            ? deliveryDispatchFailureCode(dispatchError.message)
            : "invalid_delivery_event",
          message: "The booking delivery email data is unavailable.",
        });
      }

      const { data: submittedFeedback, error: feedbackError } = await supabase
        .from("feedback")
        .select("id")
        .eq("business_id", event.business_id)
        .eq("booking_id", event.booking_id)
        .eq("feedback_link_id", dispatchContext.data.feedback_link_id)
        .maybeSingle();

      if (feedbackError) {
        return failClaimedEmailEvent({
          code: "invalid_delivery_feedback_context",
          message: "The booking delivery feedback state is unavailable.",
        });
      }

      const feedbackAlreadySubmitted = Boolean(submittedFeedback);
      const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
      const feedbackUrl = feedbackAlreadySubmitted
        ? null
        : `${baseUrl}/f/${dispatchContext.data.feedback_token}`;

      threadContext = {
        businessName: deliverySnapshot.business_name,
        bookingReference: deliverySnapshot.booking_reference,
      };
      message = bookingDeliveredEmail({
        emailEventId: event.id,
        recipientEmail: authoritativeRecipient,
        businessName: deliverySnapshot.business_name,
        bookingTitle: deliverySnapshot.title,
        bookingReference: deliverySnapshot.booking_reference,
        scheduledFor: deliverySnapshot.scheduled_for ?? null,
        deliveredAt: deliveredBooking.data.delivered_at,
        feedbackUrl,
        feedbackAlreadySubmitted,
      });
    }
  } else {
    return failClaimedEmailEvent({
      code: "unsupported_email_event",
      message: "The transactional email event type is unsupported.",
    });
  }

  if (!threadContext) {
    return failClaimedEmailEvent({
      code: "invalid_email_thread",
      message: "The booking email correlation data is unavailable.",
    });
  }

  message = applyBookingEmailThreading(message, {
    bookingId: event.booking_id,
    emailEventId: event.id,
    ...threadContext,
  });

  const result = await sendWithProviderBoundary(provider, {
    ...message,
    idempotencyKey: buildEmailAttemptIdempotencyKey(
      message.idempotencyKey,
      attempt.attempt_number,
    ),
  });

  if (result.status === "sent") {
    if (!attemptId) {
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

    const { data: finalized, error } = await supabase.rpc(
      "finalize_email_delivery_attempt",
      {
        p_email_event_id: event.id,
        p_attempt_id: attemptId,
        p_result: "SENT",
        p_provider_message_id: result.messageId,
      },
    );

    return error || !finalized
      ? { status: "failed", code: "delivery_state_update_failed" }
      : { status: "sent" };
  }

  if (!attemptId) {
    const { error } = await supabase
      .from("email_events")
      .update({
        status: "FAILED",
        failure_code: result.code.slice(0, 80),
        failure_message: result.message.slice(0, 500),
      })
      .eq("id", event.id)
      .eq("status", "SENDING");

    return {
      status: "failed",
      code: error ? "delivery_state_update_failed" : result.code,
    };
  }

  const { data: finalized, error } = await supabase.rpc(
    "finalize_email_delivery_attempt",
    {
      p_email_event_id: event.id,
      p_attempt_id: attemptId,
      p_result: "FAILED",
      p_failure_code: result.code,
      p_failure_message: result.message,
    },
  );

  return {
    status: "failed",
    code: error || !finalized ? "delivery_state_update_failed" : result.code,
  };
}
