import type { TransactionalEmailMessage } from "@/lib/email/types";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";

type BookingConfirmationRequestedEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingTitle: string;
  bookingReference: string;
  scheduledFor: string | null;
  confirmationUrl: string;
};

export function bookingConfirmationRequestedEmail(
  input: BookingConfirmationRequestedEmailInput,
): TransactionalEmailMessage {
  const rows = [
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled delivery", formatEmailDateTime(input.scheduledFor)],
  ];
  const text = withMyKustomersAttribution(
    [
      `${input.businessName} has asked you to review and confirm a booking.`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Open the secure link to review the full details and confirm.",
      input.confirmationUrl,
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Please confirm your booking - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Confirmation request",
      businessName: input.businessName,
      heading: "Please review your booking",
      introduction: [
        `${input.businessName} has asked you to review and confirm this booking.`,
        "Use the secure link below to check the full details before confirming.",
      ],
      sections: [
        {
          title: "Booking details",
          rows: rows.map(([label, value]) => ({ label, value })),
        },
      ],
      cta: { label: "Review and confirm booking", url: input.confirmationUrl },
      footer:
        "This secure link is intended only for the recipient of this booking request.",
    }),
  };
}
