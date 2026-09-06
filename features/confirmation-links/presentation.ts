import { customerContactEmailsMatch } from "@/features/customers/email";

export type ConfirmationEmailPresentation = {
  primaryKind: "confirmed_contact" | "request_recipient" | "none";
  primaryLabel:
    | "Confirmed booking contact"
    | "Confirmation request sent to"
    | "Confirmation contact";
  primaryEmail: string | null;
  requestRecipientEmail: string | null;
  requestRecipientRepeatsPrimary: boolean;
};

export function getConfirmationEmailPresentation({
  confirmed,
  confirmedContactEmail,
  requestRecipientEmail,
}: {
  confirmed: boolean;
  confirmedContactEmail: string | null;
  requestRecipientEmail: string | null;
}): ConfirmationEmailPresentation {
  const primaryKind = confirmed && confirmedContactEmail
    ? "confirmed_contact"
    : !confirmed && requestRecipientEmail
      ? "request_recipient"
      : "none";
  const primaryEmail =
    primaryKind === "confirmed_contact"
      ? confirmedContactEmail
      : primaryKind === "request_recipient"
        ? requestRecipientEmail
        : null;

  return {
    primaryKind,
    primaryLabel:
      primaryKind === "confirmed_contact"
        ? "Confirmed booking contact"
        : primaryKind === "request_recipient"
          ? "Confirmation request sent to"
          : "Confirmation contact",
    primaryEmail,
    requestRecipientEmail,
    requestRecipientRepeatsPrimary: Boolean(
      primaryEmail &&
        requestRecipientEmail &&
        customerContactEmailsMatch(primaryEmail, requestRecipientEmail),
    ),
  };
}
