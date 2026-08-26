import type { TransactionalEmailMessage } from "@/lib/email/types";
import { escapeEmailHtml, formatEmailDateTime } from "@/lib/email/templates/shared";

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
    ["Business", input.businessName],
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Previous schedule", formatEmailDateTime(input.previousScheduledFor)],
    ["New schedule", formatEmailDateTime(input.scheduledFor)],
  ];
  const text = [
    "Your booking schedule has changed.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Open the secure link to review and confirm the updated booking.",
    input.confirmationUrl,
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
    subject: `Booking rescheduled - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Your booking schedule has changed</h1><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table><p>Open the secure link to review and confirm the updated booking.</p><p><a href="${escapeEmailHtml(input.confirmationUrl)}">Review updated booking</a></p></div>`,
  };
}
