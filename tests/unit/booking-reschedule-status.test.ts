import { describe, expect, it } from "vitest";
import { isBookingReschedulable, type BookingStatus } from "@/features/bookings/status";

describe("reschedule lifecycle boundary", () => {
  it.each<[BookingStatus, boolean]>([
    ["DRAFT", true],
    ["AWAITING_CUSTOMER", true],
    ["CONFIRMED", true],
    ["IN_PROGRESS", true],
    ["READY", true],
    ["DELIVERED", false],
    ["COMPLETED", false],
    ["CANCELLED", false],
  ])("%s eligibility is %s", (status, allowed) => {
    expect(isBookingReschedulable(status)).toBe(allowed);
  });
});
