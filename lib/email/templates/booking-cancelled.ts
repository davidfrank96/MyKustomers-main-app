import type { TransactionalEmailMessage } from "@/lib/email/types";
import { normalizeCustomerContactEmail } from "@/features/customers/email";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";

type BookingCancelledEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingTitle: string;
  bookingReference: string;
  scheduledFor: string | null;
  cancellationReason: string;
  cancelledAt: string;
};

export function selectCancellationRecipient({
  confirmationContactEmail,
  customerEmail,
}: {
  confirmationContactEmail: string | null;
  customerEmail: string | null;
}) {
  const authoritativeContact = confirmationContactEmail
    ? normalizeCustomerContactEmail(confirmationContactEmail)
    : "";
  if (authoritativeContact) {
    return authoritativeContact;
  }

  return customerEmail ? normalizeCustomerContactEmail(customerEmail) || null : null;
}

export function bookingCancelledEmail(
  input: BookingCancelledEmailInput,
): TransactionalEmailMessage {
  const subject = `Booking cancelled - ${input.businessName} - ${input.bookingReference}`;
  const rows = [
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled delivery", formatEmailDateTime(input.scheduledFor)],
    ["Cancellation reason", input.cancellationReason],
    ["Cancelled", formatEmailDateTime(input.cancelledAt)],
  ];
  const paymentGuidance =
    "If you made any payment directly to the business, please contact the business regarding payment or refund arrangements.";
  const contactGuidance = `Please contact ${input.businessName} directly if you have questions.`;
  const text = withMyKustomersAttribution(
    [
      "Your booking has been cancelled.",
      "",
      `Business: ${input.businessName}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      contactGuidance,
      paymentGuidance,
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Cancellation notice",
      businessName: input.businessName,
      heading: "Your booking has been cancelled",
      introduction: [contactGuidance],
      sections: [
        {
          title: "Booking details",
          rows: rows.map(([label, value]) => ({ label, value })),
        },
      ],
      notice: paymentGuidance,
      footer: "This is a transactional record of the booking cancellation.",
      tone: "warning",
    }),
  };
}
