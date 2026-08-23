import type { TransactionalEmailMessage } from "@/lib/email/types";
import { escapeEmailHtml, formatEmailDateTime } from "@/lib/email/templates/shared";

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
  const authoritativeContact = confirmationContactEmail?.trim().toLowerCase();
  if (authoritativeContact) {
    return authoritativeContact;
  }

  return customerEmail?.trim().toLowerCase() || null;
}

export function bookingCancelledEmail(
  input: BookingCancelledEmailInput,
): TransactionalEmailMessage {
  const subject = `Booking cancelled - ${input.businessName} - ${input.bookingReference}`;
  const rows = [
    ["Business", input.businessName],
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled", formatEmailDateTime(input.scheduledFor)],
    ["Cancellation reason", input.cancellationReason],
    ["Cancelled", formatEmailDateTime(input.cancelledAt)],
  ];
  const paymentGuidance =
    "If you made any payment directly to the business, please contact the business regarding payment or refund arrangements.";
  const contactGuidance = `Please contact ${input.businessName} directly if you have questions.`;
  const text = [
    "Your booking has been cancelled.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    contactGuidance,
    paymentGuidance,
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
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Your booking has been cancelled</h1><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table><p>${escapeEmailHtml(contactGuidance)}</p><p>${escapeEmailHtml(paymentGuidance)}</p></div>`,
  };
}
