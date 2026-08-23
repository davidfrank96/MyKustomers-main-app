import { formatMoneyMinor } from "@/features/bookings/money";
import {
  amendmentFieldLabels,
  type AmendableBookingField,
} from "@/features/amendments/terms";
import type { AmendmentTerms } from "@/features/amendments/public-types";
import { escapeEmailHtml, formatEmailDateTime } from "@/lib/email/templates/shared";
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
  const htmlRows = rows
    .map(
      (row) =>
        `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${escapeEmailHtml(row.label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><strong>Current:</strong> ${escapeEmailHtml(row.current)}<br><strong>Proposed:</strong> ${escapeEmailHtml(row.proposed)}</td></tr>`,
    )
    .join("");

  return {
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
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5"><h1 style="font-size:22px">${escapeEmailHtml(heading)}</h1><p>${escapeEmailHtml(introduction)}</p><p><strong>Business:</strong> ${escapeEmailHtml(input.businessName)}<br><strong>Reference:</strong> ${escapeEmailHtml(input.bookingReference)}<br><strong>Reason:</strong> ${escapeEmailHtml(input.reason)}</p><table style="border-collapse:collapse;width:100%;max-width:620px">${htmlRows}</table></div>`,
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
    text: `${content.text}\n${guidance}\n${input.amendmentUrl}`,
    html: `${content.html}<p>${escapeEmailHtml(guidance)}</p><p><a href="${escapeEmailHtml(input.amendmentUrl)}">Review booking changes</a></p>`,
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
    text: content.text,
    html: content.html,
  };
}
