import { describe, expect, it } from "vitest";
import {
  confirmationLinkExpiresAt,
  confirmationTokenBytes,
  generateConfirmationToken,
  hashConfirmationToken,
  isPlausibleConfirmationToken,
} from "@/features/confirmation-links/token";
import {
  hasMaterialBookingFieldChange,
  isConfirmationEligibleStatus,
} from "@/features/confirmation-links/terms";
import { safePublicConfirmationMessage } from "@/features/confirmation-links/messages";
import { deriveRateLimitBucketKey } from "@/lib/security/rate-limit-key";

describe("confirmation links", () => {
  it("generates high-entropy opaque tokens and stores deterministic hashes", () => {
    const token = generateConfirmationToken();
    const secondToken = generateConfirmationToken();

    expect(confirmationTokenBytes).toBe(32);
    expect(token).not.toBe(secondToken);
    expect(isPlausibleConfirmationToken(token)).toBe(true);
    expect(hashConfirmationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashConfirmationToken(token)).toBe(hashConfirmationToken(token));
    expect(hashConfirmationToken(token)).not.toBe(hashConfirmationToken(secondToken));
  });

  it("uses a 24-hour default expiration", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    expect(confirmationLinkExpiresAt(now).toISOString()).toBe("2026-08-20T12:00:00.000Z");
  });

  it("classifies material and non-material booking changes centrally", () => {
    expect(hasMaterialBookingFieldChange(["total_amount_minor"])).toBe(true);
    expect(hasMaterialBookingFieldChange(["scheduled_for"])).toBe(true);
    expect(hasMaterialBookingFieldChange(["internal_notes"])).toBe(false);
  });

  it("allows link generation only for draft or awaiting-customer bookings", () => {
    expect(isConfirmationEligibleStatus("DRAFT")).toBe(true);
    expect(isConfirmationEligibleStatus("AWAITING_CUSTOMER")).toBe(true);
    expect(isConfirmationEligibleStatus("CONFIRMED")).toBe(false);
    expect(isConfirmationEligibleStatus("CANCELLED")).toBe(false);
  });

  it("hashes rate-limit identities without storing raw request values", () => {
    const bucket = deriveRateLimitBucketKey("test-secret", "lookup_source", [
      "source",
      "127.0.0.1",
    ]);
    expect(bucket).toMatch(/^[a-f0-9]{64}$/);
    expect(bucket).not.toContain("127.0.0.1");
  });

  it("maps unsafe public token states to safe customer wording", () => {
    expect(safePublicConfirmationMessage("expired")).not.toContain("expired");
    expect(safePublicConfirmationMessage("revoked")).not.toContain("revoked");
    expect(safePublicConfirmationMessage("unavailable")).toContain("no longer available");
  });
});
