import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";
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
  const text = withMyKustomersAttribution(
    [
      "Review an addition to your booking",
      "",
      `${input.businessName} has added something to your booking for review.`,
      `Reference: ${input.bookingReference}`,
      "",
      "Open the secure link to review and confirm the addition.",
      input.addonUrl,
    ].join("\n"),
  );
  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Booking addition",
      businessName: input.businessName,
      heading: "Review an addition to your booking",
      introduction: [
        `${input.businessName} has added something to your booking for review.`,
        "Open the secure link to review and confirm the addition.",
      ],
      sections: [
        {
          title: "Booking details",
          rows: [{ label: "Reference", value: input.bookingReference }],
        },
      ],
      cta: { label: "Review booking addition", url: input.addonUrl },
      footer: "This secure review link relates only to this booking addition.",
    }),
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
  const bookingRows = [
    ["Reference", input.bookingReference],
    ["Addition", input.addonTitle],
    ["Scheduled delivery", formatEmailDateTime(input.scheduledFor)],
  ];
  const paymentRows = [
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
  const text = withMyKustomersAttribution(
    [
      "Booking addition confirmed",
      "",
      "The additional scope is now part of your current booking agreement.",
      `Business: ${input.businessName}`,
      ...bookingRows.map(([label, value]) => `${label}: ${value}`),
      "",
      ...paymentRows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Deposit figures are recorded information only. My Kustomers did not process a payment.",
    ].join("\n"),
  );
  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Booking addition confirmed - ${input.businessName} - ${input.bookingReference}`,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Booking addition confirmed",
      businessName: input.businessName,
      heading: "Booking addition confirmed",
      introduction: [
        "The additional scope is now part of your current booking agreement.",
      ],
      sections: [
        {
          title: "Booking details",
          rows: bookingRows.map(([label, value]) => ({ label, value })),
        },
        {
          title: "Payment summary",
          rows: paymentRows.map(([label, value], index) => ({
            label,
            value,
            emphasis: index === paymentRows.length - 1,
          })),
        },
      ],
      notice:
        "Deposit figures are recorded information only. My Kustomers did not process a payment.",
      footer: "This email is a record of the booking addition you confirmed.",
      tone: "success",
    }),
  };
}
