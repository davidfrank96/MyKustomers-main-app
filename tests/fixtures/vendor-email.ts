import { bookingConfirmationRequestedEmail } from "@/lib/email/templates/booking-confirmation-requested";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";
import { bookingRescheduledEmail } from "@/lib/email/templates/booking-rescheduled";
import { bookingDeliveredEmail } from "@/lib/email/templates/booking-delivered";
import { bookingCancelledEmail } from "@/lib/email/templates/booking-cancelled";
import {
  bookingAmendmentRequestedEmail,
  bookingAmendmentConfirmedEmail,
} from "@/lib/email/templates/booking-amendment";
import {
  bookingAddonRequestedEmail,
  bookingAddonConfirmedEmail,
} from "@/lib/email/templates/booking-addon";

// Synthetic render inputs only; never sends mail or touches a database.
export function vendorEmailFixtures(
  businessName = "Harbour Studio",
  businessLogoPath: string | null = "20000000-0000-4000-8000-000000000001/logo.webp",
) {
  const base = {
    emailEventId: "fixture-event",
    recipientEmail: "fixture@example.invalid",
    businessName,
    businessLogoPath,
    bookingReference: "BK-DEMO-001",
    bookingTitle: "Studio appointment",
    scheduledFor: "2026-12-01T10:00:00Z",
  };
  const amounts = {
    currency: "EUR" as const,
    totalAmountMinor: 12000,
    depositAmountMinor: 2000,
    balanceAmountMinor: 10000,
  };
  const terms = {
    business_name: businessName,
    customer_name: "Test Customer",
    booking_reference: base.bookingReference,
    title: base.bookingTitle,
    description: null,
    currency: "EUR" as const,
    total_amount_minor: 12000,
    deposit_amount_minor: 2000,
    balance_amount_minor: 10000,
    scheduled_for: base.scheduledFor,
  };
  const amendment = {
    ...base,
    reason: "Updated scope",
    changedFields: ["title" as const],
    oldTerms: terms,
    proposedTerms: { ...terms, title: "Extended studio appointment" },
  };
  return {
    confirmationRequested: bookingConfirmationRequestedEmail({
      ...base,
      confirmationUrl: "https://mykustomers.com/c/fixture",
    }),
    confirmed: bookingConfirmedEmail({ ...base, ...amounts }),
    rescheduled: bookingRescheduledEmail({
      ...base,
      previousScheduledFor: null,
      confirmationUrl: "https://mykustomers.com/c/fixture",
    }),
    delivered: bookingDeliveredEmail({
      ...base,
      deliveredAt: "2026-12-01T11:00:00Z",
      feedbackUrl: "https://mykustomers.com/f/fixture",
    }),
    cancelled: bookingCancelledEmail({
      ...base,
      cancelledAt: "2026-11-25T11:00:00Z",
      cancellationReason: "Customer request",
    }),
    amendmentRequested: bookingAmendmentRequestedEmail({
      ...amendment,
      amendmentUrl: "https://mykustomers.com/a/fixture",
    }),
    amendmentConfirmed: bookingAmendmentConfirmedEmail(amendment),
    addonRequested: bookingAddonRequestedEmail({
      ...base,
      addonUrl: "https://mykustomers.com/x/fixture",
    }),
    addonConfirmed: bookingAddonConfirmedEmail({
      ...base,
      currency: "EUR",
      addonTitle: "Additional session",
      addonTotalAmountMinor: 3000,
      addonDepositAmountMinor: 0,
      currentTotalAmountMinor: 15000,
      currentDepositAmountMinor: 2000,
    }),
  };
}
