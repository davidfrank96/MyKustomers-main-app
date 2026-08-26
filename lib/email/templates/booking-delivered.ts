import type { TransactionalEmailMessage } from "@/lib/email/types";
import { escapeEmailHtml, formatEmailDateTime } from "@/lib/email/templates/shared";

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
    ["Business", input.businessName],
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled", formatEmailDateTime(input.scheduledFor)],
    ["Marked delivered", formatEmailDateTime(input.deliveredAt)],
  ];
  const text = [
    "Your booking has been marked as delivered.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Please contact ${input.businessName} directly if you have questions.`,
  ].join("\n");
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeEmailHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeEmailHtml(value)}</td></tr>`,
    )
    .join("");

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Booking delivered - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Your booking has been marked as delivered</h1><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table><p>Please contact ${escapeEmailHtml(input.businessName)} directly if you have questions.</p></div>`,
  };
}
