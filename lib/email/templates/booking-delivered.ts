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
  feedbackUrl?: string | null;
  feedbackAlreadySubmitted?: boolean;
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
  const feedbackAlreadySubmitted = input.feedbackAlreadySubmitted === true;
  const feedbackInvitation =
    input.feedbackUrl && !feedbackAlreadySubmitted
      ? [
          "Share private feedback about your experience using the secure link below.",
          input.feedbackUrl,
        ]
      : feedbackAlreadySubmitted
        ? ["Thank you. Your private feedback has already been received."]
        : [];
  const text = withMyKustomersAttribution(
    [
      "Your booking has been marked as delivered.",
      "",
      `${input.businessName} has marked this booking as delivered.`,
      `Business: ${input.businessName}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      ...(feedbackInvitation.length > 0 ? ["", ...feedbackInvitation] : []),
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
      cta:
        input.feedbackUrl && !feedbackAlreadySubmitted
          ? { label: "Leave feedback", url: input.feedbackUrl }
          : undefined,
      notice: feedbackAlreadySubmitted
        ? "Thank you. Your private feedback has already been received."
        : `Please contact ${input.businessName} directly if you have questions.`,
      footer: "This is a transactional update about your booking.",
      tone: "success",
    }),
  };
}
