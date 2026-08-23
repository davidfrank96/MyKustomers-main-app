import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";
import { escapeEmailHtml, formatEmailDateTime } from "@/lib/email/templates/shared";
import type { TransactionalEmailMessage } from "@/lib/email/types";

type AddonBaseInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingReference: string;
};

export function bookingAddonRequestedEmail(
  input: AddonBaseInput & { addonUrl: string },
): TransactionalEmailMessage {
  const subject = `Review a booking addition - ${input.businessName} - ${input.bookingReference}`;
  const text = [
    "Review an addition to your booking",
    "",
    `${input.businessName} has added something to your booking for review.`,
    `Reference: ${input.bookingReference}`,
    "",
    "Open the secure link to review and confirm the addition.",
    input.addonUrl,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Review an addition to your booking</h1><p>${escapeEmailHtml(input.businessName)} has added something to your booking for review.</p><p><strong>Reference:</strong> ${escapeEmailHtml(input.bookingReference)}</p><p><a href="${escapeEmailHtml(input.addonUrl)}">Review booking addition</a></p></div>`;
  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject,
    text,
    html,
  };
}

export function bookingAddonConfirmedEmail(
  input: AddonBaseInput & {
    addonTitle: string;
    scheduledFor: string | null;
    currency: BookingCurrency;
    addonTotalAmountMinor: number;
    addonDepositAmountMinor: number;
    currentTotalAmountMinor: number;
    currentDepositAmountMinor: number;
  },
): TransactionalEmailMessage {
  const currentBalance = input.currentTotalAmountMinor - input.currentDepositAmountMinor;
  const rows = [
    ["Business", input.businessName],
    ["Reference", input.bookingReference],
    ["Addition", input.addonTitle],
    ["Scheduled", formatEmailDateTime(input.scheduledFor)],
    [
      "Add-on agreed amount",
      formatMoneyMinor(input.addonTotalAmountMinor, input.currency),
    ],
    [
      "Add-on deposit recorded",
      formatMoneyMinor(input.addonDepositAmountMinor, input.currency),
    ],
    [
      "Current agreed value",
      formatMoneyMinor(input.currentTotalAmountMinor, input.currency),
    ],
    [
      "Current deposit recorded",
      formatMoneyMinor(input.currentDepositAmountMinor, input.currency),
    ],
    ["Current balance remaining", formatMoneyMinor(currentBalance, input.currency)],
  ];
  const text = [
    "Booking addition confirmed",
    "",
    "The additional scope is now part of your current booking agreement.",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Deposit figures are recorded information only. My Customers did not process a payment.",
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
    subject: `Booking addition confirmed - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">Booking addition confirmed</h1><p>The additional scope is now part of your current booking agreement.</p><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table><p>Deposit figures are recorded information only. My Customers did not process a payment.</p></div>`,
  };
}
