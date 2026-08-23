import { describe, expect, it } from "vitest";
import {
  bookingAddonConfirmedEmail,
  bookingAddonRequestedEmail,
} from "@/lib/email/templates/booking-addon";

describe("booking add-on email templates", () => {
  it("keeps proposed add-on terms out of the request email", () => {
    const email = bookingAddonRequestedEmail({
      emailEventId: "addon-request-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingReference: "MC-260823-ABC123",
      addonUrl: "https://example.test/x/secure-token",
    });

    expect(email.subject).toBe(
      "Review a booking addition - Example & Co - MC-260823-ABC123",
    );
    expect(email.idempotencyKey).toBe("email-event/addon-request-event");
    expect(email.text).toContain("https://example.test/x/secure-token");
    expect(email.text).not.toContain("24 Cupcakes");
    expect(email.text).not.toContain("18,000");
    expect(email.html).not.toContain("24 Cupcakes");
    expect(email.html).not.toContain("18,000");
  });

  it("renders confirmed add-on and current recorded totals without payment claims", () => {
    const email = bookingAddonConfirmedEmail({
      emailEventId: "addon-confirmed-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingReference: "MC-260823-ABC123",
      addonTitle: "24 <Cupcakes>",
      scheduledFor: "2026-08-25T12:00:00.000Z",
      currency: "EUR",
      addonTotalAmountMinor: 18_000,
      addonDepositAmountMinor: 5_000,
      currentTotalAmountMinor: 73_000,
      currentDepositAmountMinor: 12_000,
    });

    expect(email.subject).toBe(
      "Booking addition confirmed - Example & Co - MC-260823-ABC123",
    );
    expect(email.idempotencyKey).toBe("email-event/addon-confirmed-event");
    expect(email.text).toContain("Add-on agreed amount: €180");
    expect(email.text).toContain("Current agreed value: €730");
    expect(email.text).toContain("Current deposit recorded: €120");
    expect(email.text).toContain("Current balance remaining: €610");
    expect(email.text).toContain("did not process a payment");
    expect(email.text).not.toContain("payment received");
    expect(email.html).toContain("24 &lt;Cupcakes&gt;");
    expect(email.html).not.toContain("internal notes");
  });
});
