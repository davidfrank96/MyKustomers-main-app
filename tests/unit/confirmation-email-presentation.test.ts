import { describe, expect, it } from "vitest";
import { getConfirmationEmailPresentation } from "@/features/confirmation-links/presentation";

describe("confirmation email presentation", () => {
  it("shows no invented contact when no request or confirmation exists", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: false,
        confirmedContactEmail: null,
        requestRecipientEmail: null,
      }),
    ).toMatchObject({
      primaryKind: "none",
      primaryLabel: "Confirmation contact",
      primaryEmail: null,
      requestRecipientRepeatsPrimary: false,
    });
  });

  it("presents an outstanding request recipient without calling it confirmed", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: false,
        confirmedContactEmail: null,
        requestRecipientEmail: "VendorEntered@example.com",
      }),
    ).toMatchObject({
      primaryKind: "request_recipient",
      primaryLabel: "Confirmation request sent to",
      primaryEmail: "VendorEntered@example.com",
    });
  });

  it("presents a confirmed contact without request history", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: true,
        confirmedContactEmail: "CustomerEntered@example.com",
        requestRecipientEmail: null,
      }),
    ).toMatchObject({
      primaryKind: "confirmed_contact",
      primaryLabel: "Confirmed booking contact",
      primaryEmail: "CustomerEntered@example.com",
      requestRecipientRepeatsPrimary: false,
    });
  });

  it("makes the customer-confirmed contact primary when the addresses differ", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: true,
        confirmedContactEmail: "CustomerEntered@example.com",
        requestRecipientEmail: "VendorEntered@example.com",
      }),
    ).toMatchObject({
      primaryKind: "confirmed_contact",
      primaryEmail: "CustomerEntered@example.com",
      requestRecipientEmail: "VendorEntered@example.com",
      requestRecipientRepeatsPrimary: false,
    });
  });

  it("recognizes the same normalized address for compact request history", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: true,
        confirmedContactEmail: "Customer@EXAMPLE.COM",
        requestRecipientEmail: "Customer@example.com",
      }).requestRecipientRepeatsPrimary,
    ).toBe(true);
  });

  it("does not promote request history after a legacy contact-free confirmation", () => {
    expect(
      getConfirmationEmailPresentation({
        confirmed: true,
        confirmedContactEmail: null,
        requestRecipientEmail: "Historical@example.com",
      }),
    ).toMatchObject({
      primaryKind: "none",
      primaryEmail: null,
      requestRecipientEmail: "Historical@example.com",
    });
  });
});
