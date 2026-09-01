import type { TransactionalEmailMessage } from "@/lib/email/types";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";

type BookingDeliveredEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingTitle: string;
  bookingReference: string;
  scheduledFor: string | null;
  deliveredAt: string;
};

export function bookingDeliveredEmail(
  input: BookingDeliveredEmailInput,
): TransactionalEmailMessage {
  const rows = [
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled delivery", formatEmailDateTime(input.scheduledFor)],
    ["Marked delivered", formatEmailDateTime(input.deliveredAt)],
  ];
  const text = withMyKustomersAttribution(
    [
      "Your booking has been marked as delivered.",
      "",
      `${input.businessName} has marked this booking as delivered.`,
      `Business: ${input.businessName}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Please contact ${input.businessName} directly if you have questions.`,
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Booking delivered - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Delivery update",
      businessName: input.businessName,
      heading: "Your booking has been marked as delivered",
      introduction: [`${input.businessName} has marked this booking as delivered.`],
      sections: [
        {
          title: "Booking details",
          rows: rows.map(([label, value]) => ({ label, value })),
        },
      ],
      notice: `Please contact ${input.businessName} directly if you have questions.`,
      footer: "This is a transactional update about your booking.",
      tone: "success",
    }),
  };
}
