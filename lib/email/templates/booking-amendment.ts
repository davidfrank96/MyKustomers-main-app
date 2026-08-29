import { formatMoneyMinor } from "@/features/bookings/money";
import {
  amendmentFieldLabels,
  type AmendableBookingField,
} from "@/features/amendments/terms";
import type { AmendmentTerms } from "@/features/amendments/public-types";
import {
  formatEmailDateTime,
  renderTransactionalEmailHtml,
  withMyKustomersAttribution,
} from "@/lib/email/templates/shared";
import type { TransactionalEmailMessage } from "@/lib/email/types";

type AmendmentEmailInput = {
  emailEventId: string;
  recipientEmail: string;
  businessName: string;
  bookingReference: string;
  reason: string;
  changedFields: AmendableBookingField[];
  oldTerms: AmendmentTerms;
  proposedTerms: AmendmentTerms;
};

function displayValue(field: AmendableBookingField, terms: AmendmentTerms) {
  if (field === "scheduled_for") return formatEmailDateTime(terms.scheduled_for);
  if (field === "total_amount_minor" || field === "deposit_amount_minor") {
    return formatMoneyMinor(terms[field], terms.currency);
  }
  if (field === "description") return terms.description || "Not provided";
  return String(terms[field]);
}

function changeRows(input: AmendmentEmailInput) {
  return input.changedFields.map((field) => ({
    label: amendmentFieldLabels[field],
    current: displayValue(field, input.oldTerms),
    proposed: displayValue(field, input.proposedTerms),
  }));
}

function commonMessage(
  input: AmendmentEmailInput,
  heading: string,
  introduction: string,
) {
  const rows = changeRows(input);
  const textRows = rows.flatMap((row) => [
    row.label,
    `Current: ${row.current}`,
    `Proposed: ${row.proposed}`,
    "",
  ]);

  return {
    rows,
    text: [
      heading,
      "",
      introduction,
      `Business: ${input.businessName}`,
      `Reference: ${input.bookingReference}`,
      `Reason: ${input.reason}`,
      "",
      ...textRows,
    ].join("\n"),
  };
}

export function bookingAmendmentRequestedEmail(
  input: AmendmentEmailInput & { amendmentUrl: string },
): TransactionalEmailMessage {
  const content = commonMessage(
    input,
    "Review changes to your booking",
    `${input.businessName} has proposed changes that need your confirmation.`,
  );
  const guidance = "Open the secure link to review and confirm the proposed changes.";
  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Review booking changes - ${input.businessName} - ${input.bookingReference}`,
    text: withMyKustomersAttribution(
      `${content.text}\n${guidance}\n${input.amendmentUrl}`,
    ),
    html: renderTransactionalEmailHtml({
      contextLabel: "Booking update",
      businessName: input.businessName,
      heading: "Review changes to your booking",
      introduction: [
        `${input.businessName} has proposed changes that need your confirmation.`,
        guidance,
      ],
      sections: [
        {
          title: "Update details",
          rows: [
            { label: "Reference", value: input.bookingReference },
            { label: "Reason", value: input.reason },
            ...content.rows.map((row) => ({
              label: row.label,
              value: `Current: ${row.current}\nProposed: ${row.proposed}`,
            })),
          ],
        },
      ],
      cta: { label: "Review booking changes", url: input.amendmentUrl },
      footer: "This secure review link relates only to the proposed booking changes.",
    }),
  };
}

export function bookingAmendmentConfirmedEmail(
  input: AmendmentEmailInput,
): TransactionalEmailMessage {
  const content = commonMessage(
    input,
    "Booking changes confirmed",
    "The proposed changes are now part of your current booking agreement.",
  );
  return {
    idempotencyKey: `email-event/${input.emailEventId}`,
    to: input.recipientEmail,
    subject: `Booking changes confirmed - ${input.businessName} - ${input.bookingReference}`,
    text: withMyKustomersAttribution(content.text),
    html: renderTransactionalEmailHtml({
      contextLabel: "Booking update confirmed",
      businessName: input.businessName,
      heading: "Booking changes confirmed",
      introduction: [
        "The proposed changes are now part of your current booking agreement.",
      ],
      sections: [
        {
          title: "Confirmed changes",
          rows: [
            { label: "Reference", value: input.bookingReference },
            { label: "Reason", value: input.reason },
            ...content.rows.map((row) => ({
              label: row.label,
              value: `Previous: ${row.current}\nConfirmed: ${row.proposed}`,
            })),
          ],
        },
      ],
      footer: "This email is a record of the booking changes you confirmed.",
      tone: "success",
    }),
  };
}
