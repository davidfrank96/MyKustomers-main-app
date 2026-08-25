import { describe, expect, it } from "vitest";
import { confirmationContactSchema } from "@/features/confirmation-links/validation";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";
import {
  bookingCancelledEmail,
  selectCancellationRecipient,
} from "@/lib/email/templates/booking-cancelled";
import { sendWithProviderBoundary } from "@/lib/email/send";
import type { TransactionalEmailProvider } from "@/lib/email/types";

describe("confirmation contact and email", () => {
  it("requires and normalizes customer-provided contact details", () => {
    expect(
      confirmationContactSchema.parse({
        contactEmail: "  Customer@Example.COM ",
        contactPhone: " +353 (01) 555-0111 ",
      }),
    ).toEqual({
      contactEmail: "customer@example.com",
      contactPhone: "+353 (01) 555-0111",
    });

    expect(
      confirmationContactSchema.safeParse({ contactEmail: "", contactPhone: "" }).success,
    ).toBe(false);
    expect(
      confirmationContactSchema.safeParse({ contactEmail: "not-an-email" }).success,
    ).toBe(false);
    expect(
      confirmationContactSchema.safeParse({
        contactEmail: `${"a".repeat(250)}@example.com`,
      }).success,
    ).toBe(false);
  });

  it("renders only approved booking confirmation content", () => {
    const email = bookingConfirmedEmail({
      emailEventId: "event-id",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingTitle: "Birthday <Cake>",
      bookingReference: "MC-260820-ABC123",
      scheduledFor: "2026-08-25T12:00:00.000Z",
      currency: "EUR",
      totalAmountMinor: 45_000,
      depositAmountMinor: 5_000,
      balanceAmountMinor: 40_000,
    });

    expect(email.subject).toBe("Booking confirmed - Example & Co - MC-260820-ABC123");
    expect(email.idempotencyKey).toBe("email-event/event-id");
    expect(email.text).toContain("Balance remaining");
    expect(email.html).toContain("Birthday &lt;Cake&gt;");
    expect(email.html).not.toContain("internal notes");
    expect(email.html).not.toContain("token");
  });

  it("maps provider exceptions to a safe failure result", async () => {
    const provider: TransactionalEmailProvider = {
      name: "development",
      async send() {
        throw new Error("provider response with sensitive details");
      },
    };

    await expect(
      sendWithProviderBoundary(provider, {
        idempotencyKey: "email-event/test",
        to: "customer@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    ).resolves.toEqual({
      status: "failed",
      code: "provider_exception",
      message: "The transactional email provider request failed.",
    });
  });

  it("prefers immutable confirmation contact for cancellation delivery", () => {
    expect(
      selectCancellationRecipient({
        confirmationContactEmail: " New@Example.com ",
        customerEmail: "old@example.com",
      }),
    ).toBe("new@example.com");
    expect(
      selectCancellationRecipient({
        confirmationContactEmail: null,
        customerEmail: " fallback@example.com ",
      }),
    ).toBe("fallback@example.com");
    expect(
      selectCancellationRecipient({
        confirmationContactEmail: null,
        customerEmail: null,
      }),
    ).toBeNull();
  });

  it("renders safe cancellation content without refund promises or private data", () => {
    const email = bookingCancelledEmail({
      emailEventId: "cancel-event-id",
      recipientEmail: "new@example.com",
      businessName: "Example & Co",
      bookingTitle: "Birthday <Cake>",
      bookingReference: "MC-260823-ABC123",
      scheduledFor: "2026-08-25T12:00:00.000Z",
      cancellationReason: "Customer requested <script>alert(1)</script> cancellation",
      cancelledAt: "2026-08-23T12:00:00.000Z",
    });

    expect(email.subject).toBe("Booking cancelled - Example & Co - MC-260823-ABC123");
    expect(email.idempotencyKey).toBe("email-event/cancel-event-id");
    expect(email.text).toContain(
      "contact the business regarding payment or refund arrangements",
    );
    expect(email.text).not.toContain("refund issued");
    expect(email.html).toContain("Birthday &lt;Cake&gt;");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("internal_notes");
    expect(email.html).not.toContain("tenant");
    expect(email.html).not.toContain("token");
  });
});
