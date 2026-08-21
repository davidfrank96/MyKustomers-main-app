import "server-only";
import { z } from "zod";
import { bookingCurrencies } from "@/features/bookings/money";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";
import {
  getTransactionalEmailProvider,
} from "@/lib/email/provider";
import { sendWithProviderBoundary } from "@/lib/email/send";
import type { TransactionalEmailProvider } from "@/lib/email/types";
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

export type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "failed"; code: string }
  | { status: "skipped"; reason: "service-role-unavailable" | "not-claimable" };

export async function deliverEmailEvent(
  emailEventId: string,
  provider: TransactionalEmailProvider = getTransactionalEmailProvider(),
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

  const { data: confirmation, error: confirmationError } = await supabase
    .from("booking_confirmations")
    .select("terms_snapshot")
    .eq("id", event.booking_confirmation_id)
    .eq("business_id", event.business_id)
    .eq("booking_id", event.booking_id)
    .maybeSingle();
  const snapshot = bookingSnapshotSchema.safeParse(confirmation?.terms_snapshot);

  if (confirmationError || !snapshot.success) {
    await supabase
      .from("email_events")
      .update({
        status: "FAILED",
        failure_code: "invalid_confirmation_snapshot",
        failure_message: "The booking confirmation email data is unavailable.",
      })
      .eq("id", event.id)
      .eq("status", "SENDING");

    return { status: "failed", code: "invalid_confirmation_snapshot" };
  }

  const result = await sendWithProviderBoundary(
    provider,
    bookingConfirmedEmail({
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
    }),
  );

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
