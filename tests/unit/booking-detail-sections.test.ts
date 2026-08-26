import { describe, expect, it } from "vitest";
import { getDefaultOpenBookingDetailSection } from "@/features/bookings/detail-sections";
import type { BookingStatus } from "@/features/bookings/status";

function sectionFor(
  status: BookingStatus,
  overrides: Partial<Parameters<typeof getDefaultOpenBookingDetailSection>[0]> = {},
) {
  return getDefaultOpenBookingDetailSection({
    status,
    feedbackReceived: false,
    pendingAmendment: false,
    awaitingAddon: false,
    ...overrides,
  });
}

describe("booking detail default section", () => {
  it.each([
    ["DRAFT", "customer-confirmation"],
    ["AWAITING_CUSTOMER", "customer-confirmation"],
    ["CONFIRMED", "operational-progress"],
    ["IN_PROGRESS", "operational-progress"],
    ["READY", "operational-progress"],
    ["DELIVERED", "booking-payments"],
    ["COMPLETED", "private-feedback"],
    ["CANCELLED", null],
  ] satisfies Array<[BookingStatus, string | null]>)(
    "opens the contextual section for %s",
    (status, expected) => {
      expect(sectionFor(status)).toBe(expected);
    },
  );

  it("does not auto-open completed feedback after feedback is received", () => {
    expect(sectionFor("COMPLETED", { feedbackReceived: true })).toBeNull();
  });

  it("prioritizes pending amendment and add-on customer actions", () => {
    expect(sectionFor("IN_PROGRESS", { pendingAmendment: true })).toBe("booking-changes");
    expect(sectionFor("IN_PROGRESS", { awaitingAddon: true })).toBe("booking-addons");
    expect(
      sectionFor("IN_PROGRESS", { pendingAmendment: true, awaitingAddon: true }),
    ).toBe("booking-changes");
  });
});
