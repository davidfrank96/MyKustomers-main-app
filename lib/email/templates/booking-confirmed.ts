import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";
import type { TransactionalEmailMessage } from "@/lib/email/types";

type BookingConfirmedEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingTitle: string;
  bookingReference: string;
  scheduledFor: string | null;
  currency: BookingCurrency;
  totalAmountMinor: number;
  depositAmountMinor: number;
  balanceAmountMinor: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatScheduledFor(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function bookingConfirmedEmail(
  input: BookingConfirmedEmailInput,
): TransactionalEmailMessage {
  const subject = `Booking confirmed - ${input.businessName} - ${input.bookingReference}`;
  const scheduled = formatScheduledFor(input.scheduledFor);
  const total = formatMoneyMinor(input.totalAmountMinor, input.currency);
  const deposit = formatMoneyMinor(input.depositAmountMinor, input.currency);
  const balance = formatMoneyMinor(input.balanceAmountMinor, input.currency);
  const rows = [
    ["Business", input.businessName],
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled", scheduled],
    ["Agreed total", total],
    ["Deposit recorded", deposit],
    ["Balance remaining", balance],
  ];

  const text = [
    "Your booking is confirmed.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "This email acknowledges the booking details you confirmed.",
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Your booking is confirmed</h1><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table><p>This email acknowledges the booking details you confirmed.</p></div>`,
  };
}
