import { describe, expect, it } from "vitest";
import { bookingAmendmentSchema } from "@/features/amendments/validation";
import { buildAmendmentShareMessage } from "@/features/amendments/share";
import {
  bookingAmendmentConfirmedEmail,
  bookingAmendmentRequestedEmail,
} from "@/lib/email/templates/booking-amendment";

const oldTerms = {
  business_name: "Example & Co",
  customer_name: "Sarah",
  booking_reference: "MC-260823-ABC123",
  title: "10-inch <cake>",
  description: "Small cake",
  currency: "EUR" as const,
  total_amount_minor: 45_000,
  deposit_amount_minor: 5_000,
  balance_amount_minor: 40_000,
  scheduled_for: "2026-08-25T12:00:00.000Z",
};

const proposedTerms = {
  ...oldTerms,
  title: "12-inch cake",
  total_amount_minor: 55_000,
  balance_amount_minor: 50_000,
};

describe("booking amendments", () => {
  it("requires bounded plain-text reasons and valid proposed financial terms", () => {
    const valid = bookingAmendmentSchema.safeParse({
      reason: "Customer requested a larger cake.",
      title: "12-inch cake",
      description: "Large cake",
      currency: "EUR",
      totalAmount: "550.00",
      depositAmount: "50.00",
      scheduledFor: "2027-08-25T12:00:00.000Z",
    });
    expect(valid.success).toBe(true);
    expect(
      bookingAmendmentSchema.safeParse({
        reason: "<b>Change</b>",
        title: "Cake",
        currency: "EUR",
        totalAmount: "10",
        depositAmount: "20",
      }).success,
    ).toBe(false);
  });

  it("builds contextual share copy without exposing terms", () => {
    const message = buildAmendmentShareMessage({
      customerName: "Sarah Jones",
      businessName: "Example Bakery",
    });
    expect(message).toContain("Hi Sarah,");
    expect(message).toContain("Example Bakery has proposed an update");
    expect(message).not.toContain("55,000");
    expect(message).not.toContain("scheduled");
  });

  it("renders only changed approved terms with neutral payment wording", () => {
    const base = {
      emailEventId: "amendment-event",
      recipientEmail: "customer@example.com",
      businessName: "Example & Co",
      bookingReference: oldTerms.booking_reference,
      reason: "Customer requested a larger cake.",
      changedFields: ["title", "total_amount_minor"] as const,
      oldTerms,
      proposedTerms,
    };
    const requested = bookingAmendmentRequestedEmail({
      ...base,
      changedFields: [...base.changedFields],
      amendmentUrl: "https://example.com/a/opaque-token",
    });
    const confirmed = bookingAmendmentConfirmedEmail({
      ...base,
      changedFields: [...base.changedFields],
    });
    expect(requested.text).toContain("Current: €450");
    expect(requested.text).toContain("Proposed: €550");
    expect(requested.html).toContain("10-inch &lt;cake&gt;");
    expect(confirmed.text).toContain("Booking changes confirmed");
    for (const message of [requested, confirmed]) {
      expect(message.text).not.toContain("Payment received");
      expect(message.text).not.toContain("Payment verified");
      expect(message.text).not.toContain("Refund");
      expect(message.text).not.toContain("Charge");
    }
  });
});
