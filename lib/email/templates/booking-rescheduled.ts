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
  businessLogoPath?: string | null;
  bookingTitle: string;
  bookingReference: string;
  previousScheduledFor: string | null;
  scheduledFor: string;
  confirmationUrl?: string;
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
      input.confirmationUrl
        ? "Open the secure link to review and confirm the updated booking."
        : "No action is required. Contact the business if you have questions.",
      input.confirmationUrl ?? "",
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `${input.confirmationUrl ? "Booking rescheduled" : "Booking schedule updated"} - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Schedule update",
      businessName: input.businessName,
      businessLogoPath: input.businessLogoPath,
      heading: "Your booking schedule has changed",
      introduction: [
        input.confirmationUrl
          ? `${input.businessName} has proposed a new delivery schedule for your booking.`
          : `${input.businessName} has updated the schedule for your booking.`,
        input.confirmationUrl
          ? "Open the secure link to review and confirm the updated booking."
          : "No action is required. Contact the business if you have questions.",
      ],
      sections: [
        {
          title: "Schedule details",
          rows: rows.map(([label, value]) => ({ label, value })),
        },
      ],
      cta: input.confirmationUrl
        ? {
            label: "Review updated booking",
            url: input.confirmationUrl,
          }
        : undefined,
      footer: input.confirmationUrl
        ? "This secure review link relates only to this booking update."
        : "Your original booking confirmation remains on record.",
    }),
  };
}
