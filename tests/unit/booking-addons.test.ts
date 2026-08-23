import { describe, expect, it } from "vitest";
import { bookingAddonSchema } from "@/features/addons/validation";
import { deriveEffectiveBookingTotals } from "@/features/addons/totals";
import {
  addonExpiresAt,
  generateAddonToken,
  hashAddonToken,
  isPlausibleAddonToken,
} from "@/features/addons/token";
import { buildAddonShareMessage } from "@/features/addons/share";

describe("booking add-ons", () => {
  it("validates structured integer-minor-unit amounts", () => {
    expect(
      bookingAddonSchema.parse({
        title: "24 Cupcakes",
        description: "Matching decoration",
        totalAmount: "18000",
        depositAmount: "5000",
      }),
    ).toEqual({
      title: "24 Cupcakes",
      description: "Matching decoration",
      totalAmount: 1_800_000,
      depositAmount: 500_000,
    });
    expect(
      bookingAddonSchema.safeParse({
        title: "Invalid",
        description: "",
        totalAmount: "-1",
        depositAmount: "0",
      }).success,
    ).toBe(false);
    expect(
      bookingAddonSchema.safeParse({
        title: "Invalid",
        description: "",
        totalAmount: "10",
        depositAmount: "11",
      }).success,
    ).toBe(false);
    expect(
      bookingAddonSchema.safeParse({
        title: "Overflow",
        description: "",
        totalAmount: "90071992547410",
        depositAmount: "0",
      }).success,
    ).toBe(false);
  });

  it("derives totals from confirmed add-ons without increasing booking count", () => {
    expect(
      deriveEffectiveBookingTotals(
        { total_amount_minor: 45_000, deposit_amount_minor: 20_000 },
        [
          {
            status: "CONFIRMED",
            total_amount_minor: 18_000,
            deposit_amount_minor: 5_000,
          },
          {
            status: "AWAITING_CUSTOMER",
            total_amount_minor: 30_000,
            deposit_amount_minor: 10_000,
          },
          { status: "CONFIRMED", total_amount_minor: 7_000, deposit_amount_minor: 1_000 },
          {
            status: "CANCELLED",
            total_amount_minor: 99_000,
            deposit_amount_minor: 99_000,
          },
        ],
      ),
    ).toEqual({
      totalAmountMinor: 70_000,
      depositAmountMinor: 26_000,
      balanceAmountMinor: 44_000,
      confirmedAddonCount: 2,
    });
  });

  it("uses a distinct high-entropy hash-only capability and a 24-hour expiry", () => {
    const token = generateAddonToken();
    expect(isPlausibleAddonToken(token)).toBe(true);
    expect(hashAddonToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAddonToken(token)).not.toBe(token);
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(addonExpiresAt(now).toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });

  it("keeps private add-on terms out of trusted share text", () => {
    const message = buildAddonShareMessage({
      customerName: "Sarah Example",
      businessName: "Divine Cakes",
    });
    expect(message).toContain("Hi Sarah,");
    expect(message).toContain("has added an item to your existing booking");
    expect(message).not.toContain("18,000");
    expect(message).not.toContain("cupcakes");
  });
});
