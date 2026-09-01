import { describe, expect, it, vi } from "vitest";
import { bookingDeliveredEmail } from "@/lib/email/templates/booking-delivered";
import { bookingRescheduledEmail } from "@/lib/email/templates/booking-rescheduled";
import { applyBookingEmailThreading } from "@/lib/email/threading";

vi.mock("server-only", () => ({}));

describe("booking customer communication email", () => {
  it("renders a reschedule notice with only the replacement secure link", () => {
    const email = bookingRescheduledEmail({
      emailEventId: "reschedule-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingTitle: "Private <Event>",
      bookingReference: "MC-260826-ABC123",
      previousScheduledFor: "2026-08-27T10:00:00.000Z",
      scheduledFor: "2026-08-28T10:00:00.000Z",
      confirmationUrl: "https://mykustomers.com/c/controlled-token",
    });

    expect(email.text).toContain("Previous schedule");
    expect(email.text).toContain("New schedule");
    expect(email.text).toContain("https://mykustomers.com/c/controlled-token");
    expect(email.html).toContain("Private &lt;Event&gt;");
    expect(email.html).not.toContain("internal notes");
  });

  it("renders delivery as a status notice without claiming receipt", () => {
    const email = bookingDeliveredEmail({
      emailEventId: "delivery-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingTitle: "Birthday Cake",
      bookingReference: "MC-260826-ABC123",
      scheduledFor: "2026-08-27T10:00:00.000Z",
      deliveredAt: "2026-08-27T10:05:00.000Z",
      feedbackUrl: "https://mykustomers.com/f/controlled-token",
    });

    expect(email.text).toContain("marked as delivered");
    expect(email.text).not.toContain("received your booking");
    expect(email.text).not.toContain("payment received");
    expect(email.text).toContain("https://mykustomers.com/f/controlled-token");
    expect(email.html).toContain("Leave feedback");
  });

  it("omits the feedback call to action after feedback was already submitted", () => {
    const email = bookingDeliveredEmail({
      emailEventId: "delivery-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingTitle: "Birthday Cake",
      bookingReference: "MC-260826-ABC123",
      scheduledFor: "2026-08-27T10:00:00.000Z",
      deliveredAt: "2026-08-27T10:05:00.000Z",
      feedbackUrl: "https://mykustomers.com/f/controlled-token",
      feedbackAlreadySubmitted: true,
    });

    expect(email.text).toContain("private feedback has already been received");
    expect(email.html).toContain("private feedback has already been received");
    expect(email.text).not.toContain("controlled-token");
    expect(email.html).not.toContain("Leave feedback");
  });

  it("uses one stable subject family and opaque non-PII correlation headers", () => {
    const first = applyBookingEmailThreading(
      {
        idempotencyKey: "email-event/one",
        to: "customer@example.com",
        subject: "Booking confirmed",
        html: "<p>Confirmed</p>",
        text: "Confirmed",
      },
      {
        bookingId: "11111111-1111-4111-8111-111111111111",
        emailEventId: "22222222-2222-4222-8222-222222222222",
        businessName: "Example & Co",
        bookingReference: "MC-260826-ABC123",
      },
    );
    const second = applyBookingEmailThreading(
      { ...first, subject: "Booking delivered" },
      {
        bookingId: "11111111-1111-4111-8111-111111111111",
        emailEventId: "33333333-3333-4333-8333-333333333333",
        businessName: "Example & Co",
        bookingReference: "MC-260826-ABC123",
      },
    );

    expect(first.subject).toBe(second.subject);
    expect(first.headers?.["X-MyKustomers-Thread-Key"]).toBe(
      second.headers?.["X-MyKustomers-Thread-Key"],
    );
    expect(first.headers?.["X-MyKustomers-Message-Key"]).not.toBe(
      second.headers?.["X-MyKustomers-Message-Key"],
    );
    expect(JSON.stringify(first.headers)).not.toContain("11111111-1111");
    expect(JSON.stringify(first.headers)).not.toContain("customer@example.com");
  });
});
