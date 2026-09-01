import { describe, expect, it } from "vitest";
import { bookingConfirmationRequestedEmail } from "@/lib/email/templates/booking-confirmation-requested";

describe("booking confirmation request email", () => {
  it("uses the reviewed recipient and secure confirmation URL", () => {
    const message = bookingConfirmationRequestedEmail({
      emailEventId: "event-1",
      recipientEmail: "David.Frank@hotmail.com",
      businessName: "Bright Cleaning",
      bookingTitle: "Deep clean",
      bookingReference: "BK-1042",
      scheduledFor: "2026-09-03T10:00:00.000Z",
      confirmationUrl: "https://app.example.com/c/secret-token",
    });

    expect(message.to).toBe("David.Frank@hotmail.com");
    expect(message.idempotencyKey).toBe("email-event/event-1");
    expect(message.subject).toContain("BK-1042");
    expect(message.text).toContain("https://app.example.com/c/secret-token");
    expect(message.html).toContain("Review and confirm booking");
  });
});
