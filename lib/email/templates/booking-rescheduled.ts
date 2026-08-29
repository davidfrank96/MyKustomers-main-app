import type { TransactionalEmailMessage } from "@/lib/email/types";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";

type BookingRescheduledEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingTitle: string;
  bookingReference: string;
  previousScheduledFor: string | null;
  scheduledFor: string;
  confirmationUrl: string;
};

export function bookingRescheduledEmail(
  input: BookingRescheduledEmailInput,
): TransactionalEmailMessage {
  const rows = [
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Previous schedule", formatEmailDateTime(input.previousScheduledFor)],
    ["New schedule", formatEmailDateTime(input.scheduledFor)],
  ];
  const text = withMyKustomersAttribution(
    [
      "Your booking schedule has changed.",
      "",
      `Business: ${input.businessName}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Open the secure link to review and confirm the updated booking.",
      input.confirmationUrl,
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Booking rescheduled - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Schedule update",
      businessName: input.businessName,
      heading: "Your booking schedule has changed",
      introduction: [
        `${input.businessName} has proposed a new delivery schedule for your booking.`,
        "Open the secure link to review and confirm the updated booking.",
      ],
      sections: [
        {
          title: "Schedule details",
          rows: rows.map(([label, value]) => ({ label, value })),
        },
      ],
      cta: {
        label: "Review updated booking",
        url: input.confirmationUrl,
      },
      footer: "This secure review link relates only to this booking update.",
    }),
  };
}
