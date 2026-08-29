import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";
import type { TransactionalEmailMessage } from "@/lib/email/types";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";

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

export function bookingConfirmedEmail(
  input: BookingConfirmedEmailInput,
): TransactionalEmailMessage {
  const subject = `Booking confirmed - ${input.businessName} - ${input.bookingReference}`;
  const scheduled = formatEmailDateTime(input.scheduledFor);
  const total = formatMoneyMinor(input.totalAmountMinor, input.currency);
  const deposit = formatMoneyMinor(input.depositAmountMinor, input.currency);
  const balance = formatMoneyMinor(input.balanceAmountMinor, input.currency);
  const bookingRows = [
    ["Booking", input.bookingTitle],
    ["Reference", input.bookingReference],
    ["Scheduled delivery", scheduled],
  ];
  const paymentRows = [
    ["Agreed total", total],
    ["Deposit recorded", deposit],
    ["Balance remaining", balance],
  ];

  const text = withMyKustomersAttribution(
    [
      "Your booking is confirmed.",
      "",
      `Thanks for confirming your booking with ${input.businessName}.`,
      "Here is a record of the booking details you confirmed.",
      "",
      `Business: ${input.businessName}`,
      ...bookingRows.map(([label, value]) => `${label}: ${value}`),
      "",
      ...paymentRows.map(([label, value]) => `${label}: ${value}`),
      "",
      "This email is a record of the booking details you confirmed.",
    ].join("\n"),
  );

  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject,
    text,
    html: renderTransactionalEmailHtml({
      contextLabel: "Booking confirmation",
      businessName: input.businessName,
      heading: "Your booking is confirmed",
      introduction: [
        `Thanks for confirming your booking with ${input.businessName}.`,
        "Here is a record of the booking details you confirmed.",
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
      footer: "This email is a record of the booking details you confirmed.",
      tone: "success",
    }),
  };
}
