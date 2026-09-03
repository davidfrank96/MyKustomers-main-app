import { describe, expect, it } from "vitest";
import {
  bookingAddonConfirmedEmail,
  bookingAddonRequestedEmail,
} from "@/lib/email/templates/booking-addon";
import {
  bookingAmendmentConfirmedEmail,
  bookingAmendmentRequestedEmail,
} from "@/lib/email/templates/booking-amendment";
import { bookingCancelledEmail } from "@/lib/email/templates/booking-cancelled";
import { bookingConfirmedEmail } from "@/lib/email/templates/booking-confirmed";
import { bookingDeliveredEmail } from "@/lib/email/templates/booking-delivered";
import { bookingRescheduledEmail } from "@/lib/email/templates/booking-rescheduled";

const maliciousBusiness = `A Very Long Business Name & <script>alert("business")</script> Studio`;
const maliciousTitle = `A very long booking title <img src=x onerror="alert('title')"> that must wrap`;
const longReference = `MC-260829-${"REFERENCE".repeat(10)}`;
const eventId = "11111111-1111-4111-8111-111111111111";

function expectSafeEmailHtml(html: string) {
  expect(html).toContain("max-width:600px");
  expect(html).toContain("@media only screen and (max-width: 480px)");
  expect(html).toContain("overflow-wrap:anywhere");
  expect(html).not.toMatch(/<script[\s>]/i);
  expect(html).not.toMatch(/<img\s+src=x/i);
  expect(html).not.toContain(eventId);
  expect(html).not.toMatch(/\{\{|\}\}|\$\{/);
  expect(html).not.toContain("internal notes");
  expect(html).not.toContain("Payment verified");
}

function expectMyKustomersAttribution(email: { html: string; text: string }) {
  for (const content of [email.html, email.text]) {
    expect(content).toContain("Want to know more about My Kustomers?");
    expect(content).toContain("https://mykustomers.com");
    expect(content).not.toMatch(/localhost|127\.0\.0\.1|vercel\.app/i);
  }
  expect(email.html).toContain('href="https://mykustomers.com"');
  expect(email.html).toContain(
    'src="https://mykustomers.com/brand/mykustomers/v1/email/mykustomers-email-logo-512w.png"',
  );
  expect(email.html).toContain('alt="MyKustomers.com"');
  expect(email.html).toContain("Visit My Kustomers");
}

describe("transactional email presentation", () => {
  it("renders a mobile-safe confirmation with real financial states", () => {
    const scenarios = [
      { depositAmountMinor: 0, balanceAmountMinor: 999_999_999_900 },
      { depositAmountMinor: 999_999_999_900, balanceAmountMinor: 0 },
    ];

    for (const scenario of scenarios) {
      const email = bookingConfirmedEmail({
        emailEventId: eventId,
        recipientEmail: "controlled@example.com",
        businessName: maliciousBusiness,
        bookingTitle: maliciousTitle,
        bookingReference: longReference,
        scheduledFor: "2026-12-31T23:59:00.000Z",
        currency: "NGN",
        totalAmountMinor: 999_999_999_900,
        ...scenario,
      });

      expect(email.text).toContain("Here is a record of the booking details");
      expect(email.text).toContain("Agreed total");
      expect(email.text).toContain("Deposit recorded");
      expect(email.text).toContain("Balance remaining");
      expect(email.html).toContain("Payment summary");
      expect(email.html).toContain("A Very Long Business Name &amp;");
      expect(email.html).toContain("&lt;script&gt;");
      expect(email.html).toContain("&lt;img src=x onerror=&quot;");
      expectSafeEmailHtml(email.html);
    }
  });

  it("keeps delivered, cancelled, and rescheduled notices in the shared shell", () => {
    const delivered = bookingDeliveredEmail({
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: maliciousBusiness,
      bookingTitle: maliciousTitle,
      bookingReference: longReference,
      scheduledFor: null,
      deliveredAt: "2026-08-29T12:31:00.000Z",
    });
    const cancelled = bookingCancelledEmail({
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: maliciousBusiness,
      bookingTitle: maliciousTitle,
      bookingReference: longReference,
      scheduledFor: "2026-08-30T12:31:00.000Z",
      cancellationReason: "Customer requested <b>cancellation</b>.",
      cancelledAt: "2026-08-29T12:31:00.000Z",
    });
    const rescheduled = bookingRescheduledEmail({
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: maliciousBusiness,
      bookingTitle: maliciousTitle,
      bookingReference: longReference,
      previousScheduledFor: null,
      scheduledFor: "2026-08-30T12:31:00.000Z",
      confirmationUrl: "https://mykustomers.com/c/controlled-token?a=1&b=2",
    });

    expect(delivered.html).toContain("Delivery update");
    expect(cancelled.html).toContain("Cancellation notice");
    expect(cancelled.html).toContain("&lt;b&gt;cancellation&lt;/b&gt;");
    expect(rescheduled.html).toContain("Review updated booking");
    expect(rescheduled.html).toContain("a=1&amp;b=2");
    expect(rescheduled.text).toContain(
      "https://mykustomers.com/c/controlled-token?a=1&b=2",
    );
    for (const email of [delivered, cancelled, rescheduled]) {
      expectSafeEmailHtml(email.html);
    }
  });

  it("keeps add-on and amendment emails provider-neutral and safely escaped", () => {
    const addOn = bookingAddonConfirmedEmail({
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: maliciousBusiness,
      bookingReference: longReference,
      addonTitle: maliciousTitle,
      scheduledFor: "2026-08-30T12:31:00.000Z",
      currency: "NGN",
      addonTotalAmountMinor: 500_000,
      addonDepositAmountMinor: 0,
      currentTotalAmountMinor: 999_999_999_900,
      currentDepositAmountMinor: 500_000,
    });
    const oldTerms = {
      business_name: maliciousBusiness,
      customer_name: "Controlled Customer",
      booking_reference: longReference,
      title: maliciousTitle,
      description: "Current scope",
      currency: "NGN" as const,
      total_amount_minor: 500_000,
      deposit_amount_minor: 0,
      balance_amount_minor: 500_000,
      scheduled_for: "2026-08-30T12:31:00.000Z",
    };
    const amendment = bookingAmendmentRequestedEmail({
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: maliciousBusiness,
      bookingReference: longReference,
      reason: "Customer requested <b>more work</b>.",
      changedFields: ["title", "total_amount_minor"],
      oldTerms,
      proposedTerms: {
        ...oldTerms,
        title: "Updated safe scope",
        total_amount_minor: 750_000,
        balance_amount_minor: 750_000,
      },
      amendmentUrl: "https://mykustomers.com/a/controlled-token",
    });

    expect(addOn.text).toContain("did not process a payment");
    expect(addOn.text).not.toContain("Payment verified");
    expect(amendment.html).toContain("&lt;b&gt;more work&lt;/b&gt;");
    expect(amendment.text).toContain("https://mykustomers.com/a/controlled-token");
    expectSafeEmailHtml(addOn.html);
    expectSafeEmailHtml(amendment.html);
  });

  it("adds canonical platform attribution to every supported lifecycle email", () => {
    const oldTerms = {
      business_name: "Controlled Business",
      customer_name: "Controlled Customer",
      booking_reference: "MC-CONTROLLED",
      title: "Controlled booking",
      description: "Controlled scope",
      currency: "NGN" as const,
      total_amount_minor: 500_000,
      deposit_amount_minor: 100_000,
      balance_amount_minor: 400_000,
      scheduled_for: "2026-08-30T12:31:00.000Z",
    };
    const base = {
      emailEventId: eventId,
      recipientEmail: "controlled@example.com",
      businessName: "Controlled Business",
      bookingReference: "MC-CONTROLLED",
    };
    const amendmentBase = {
      ...base,
      reason: "Controlled change",
      changedFields: ["title"] as const,
      oldTerms,
      proposedTerms: { ...oldTerms, title: "Updated controlled booking" },
    };
    const emails = [
      bookingConfirmedEmail({
        ...base,
        bookingTitle: "Controlled booking",
        scheduledFor: oldTerms.scheduled_for,
        currency: "NGN",
        totalAmountMinor: 500_000,
        depositAmountMinor: 100_000,
        balanceAmountMinor: 400_000,
      }),
      bookingDeliveredEmail({
        ...base,
        bookingTitle: "Controlled booking",
        scheduledFor: oldTerms.scheduled_for,
        deliveredAt: "2026-08-30T13:31:00.000Z",
      }),
      bookingCancelledEmail({
        ...base,
        bookingTitle: "Controlled booking",
        scheduledFor: oldTerms.scheduled_for,
        cancellationReason: "Controlled cancellation",
        cancelledAt: "2026-08-30T13:31:00.000Z",
      }),
      bookingRescheduledEmail({
        ...base,
        bookingTitle: "Controlled booking",
        previousScheduledFor: oldTerms.scheduled_for,
        scheduledFor: "2026-09-01T12:31:00.000Z",
        confirmationUrl: "https://mykustomers.com/c/secure-token",
      }),
      bookingAddonRequestedEmail({
        ...base,
        addonUrl: "https://mykustomers.com/addons/secure-token",
      }),
      bookingAddonConfirmedEmail({
        ...base,
        addonTitle: "Controlled addition",
        scheduledFor: oldTerms.scheduled_for,
        currency: "NGN",
        addonTotalAmountMinor: 50_000,
        addonDepositAmountMinor: 0,
        currentTotalAmountMinor: 550_000,
        currentDepositAmountMinor: 100_000,
      }),
      bookingAmendmentRequestedEmail({
        ...amendmentBase,
        changedFields: [...amendmentBase.changedFields],
        amendmentUrl: "https://mykustomers.com/amendments/secure-token",
      }),
      bookingAmendmentConfirmedEmail({
        ...amendmentBase,
        changedFields: [...amendmentBase.changedFields],
      }),
    ];

    for (const email of emails) {
      expectMyKustomersAttribution(email);
      expectSafeEmailHtml(email.html);
    }
  });
});
