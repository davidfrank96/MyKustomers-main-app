import { describe, expect, it } from "vitest";
import {
  bookingIssueCreateSchema,
  isFeedbackEligibleStatus,
  isResolvableIssueStatus,
  publicFeedbackSchema,
} from "@/features/feedback/validation";
import {
  feedbackLinkExpiresAt,
  generateFeedbackToken,
  hashFeedbackToken,
  isPlausibleFeedbackToken,
} from "@/features/feedback/token";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import {
  buildFeedbackShareMessage,
  buildFeedbackShareTitle,
  isFeedbackShareMethod,
} from "@/features/feedback/share";
import { buildFeedbackMetadata } from "@/features/feedback/metadata";
import {
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  composeCustomerConfirmationShareMessage,
} from "@/features/confirmation-links/share";

describe("Phase 8 feedback domain", () => {
  it("accepts concise private feedback and transforms yes/no answers", () => {
    const parsed = publicFeedbackSchema.parse({
      overallRating: "5",
      onTime: "yes",
      metExpectations: "no",
      comment: "Helpful and private.",
    });

    expect(parsed).toEqual({
      overallRating: 5,
      onTime: true,
      metExpectations: false,
      comment: "Helpful and private.",
    });
  });

  it("rejects invalid rating bounds and HTML-like comments", () => {
    expect(
      publicFeedbackSchema.safeParse({
        overallRating: "0",
        onTime: "yes",
        metExpectations: "yes",
        comment: "",
      }).success,
    ).toBe(false);
    expect(
      publicFeedbackSchema.safeParse({
        overallRating: "6",
        onTime: "yes",
        metExpectations: "yes",
        comment: "",
      }).success,
    ).toBe(false);
    expect(
      publicFeedbackSchema.safeParse({
        overallRating: "4",
        onTime: "yes",
        metExpectations: "yes",
        comment: "<strong>Nice</strong>",
      }).success,
    ).toBe(false);
  });

  it("only allows feedback requests for completed bookings", () => {
    expect(isFeedbackEligibleStatus("COMPLETED")).toBe(true);
    for (const status of [
      "DRAFT",
      "AWAITING_CUSTOMER",
      "CONFIRMED",
      "IN_PROGRESS",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ]) {
      expect(isFeedbackEligibleStatus(status)).toBe(false);
    }
  });

  it("uses 14-day plausible hash-only feedback tokens", () => {
    const token = generateFeedbackToken();
    expect(isPlausibleFeedbackToken(token)).toBe(true);
    expect(hashFeedbackToken(token)).toMatch(/^[a-f0-9]{64}$/);

    const expiresAt = feedbackLinkExpiresAt(new Date("2026-08-19T00:00:00.000Z"));
    expect(expiresAt.toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });

  it("keeps confirmation and feedback token hashes purpose-separated by table/RPC design", () => {
    const confirmationToken = generateConfirmationToken();
    const feedbackToken = generateFeedbackToken();

    expect(hashConfirmationToken(confirmationToken)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashFeedbackToken(feedbackToken)).toMatch(/^[a-f0-9]{64}$/);
    expect(confirmationToken).not.toBe(feedbackToken);
  });

  it("builds a private, no-account feedback request with safe contextual names", () => {
    const message = buildFeedbackShareMessage({
      customerName: "Sarah Jones",
      businessName: "Divine\u0000 Cakes",
    });

    expect(message).toBe(
      "Hi Sarah, thank you for choosing Divine Cakes. We'd appreciate your private feedback about your experience. No account is required. You can share it securely using the link below.",
    );
    expect(message).not.toMatch(/publish|public review/i);
    expect(buildFeedbackShareTitle("Divine Cakes")).toBe(
      "Share private feedback with Divine Cakes",
    );
    expect(isFeedbackShareMethod("copy_link")).toBe(true);
    expect(isFeedbackShareMethod("email")).toBe(false);
  });

  it("encodes feedback sharing intents without changing the controlled URL", () => {
    const message = "Private feedback? Yes & securely.";
    const feedbackUrl = "https://app.example.com/f/opaque_token";
    const whatsApp = new URL(buildWhatsAppShareUrl(message, feedbackUrl));
    const telegram = new URL(buildTelegramShareUrl(message, feedbackUrl));

    expect(whatsApp.searchParams.get("text")).toBe(
      composeCustomerConfirmationShareMessage(message, feedbackUrl),
    );
    expect(telegram.searchParams.get("text")).toBe(message);
    expect(telegram.searchParams.get("url")).toBe(feedbackUrl);
  });

  it("builds feedback metadata without customer or booking details", () => {
    const metadata = buildFeedbackMetadata({
      token: "token with spaces",
      businessName: "Divine Cakes",
    });

    expect(metadata.title).toBe("Share private feedback with Divine Cakes");
    expect(metadata.description).toBe(
      "Divine Cakes has requested private feedback about your experience.",
    );
    expect(metadata.canonicalUrl).toContain("/f/token%20with%20spaces");
    expect(JSON.stringify(metadata)).not.toMatch(/Sarah|booking|amount|schedule/i);
  });

  it("validates issue creation and terminal resolution rule", () => {
    expect(
      bookingIssueCreateSchema.parse({
        category: "LATE_DELIVERY",
        description: "Delivery finished after the agreed time.",
      }),
    ).toEqual({
      category: "LATE_DELIVERY",
      description: "Delivery finished after the agreed time.",
    });
    expect(
      bookingIssueCreateSchema.safeParse({
        category: "NOT_REAL",
        description: "Invalid category.",
      }).success,
    ).toBe(false);
    expect(isResolvableIssueStatus("OPEN")).toBe(true);
    expect(isResolvableIssueStatus("RESOLVED")).toBe(false);
  });
});
