import { describe, expect, it } from "vitest";
import {
  deriveBalanceMinor,
  formatMoneyMinor,
  parseMoneyToMinorUnits,
} from "@/features/bookings/money";
import {
  getAllowedBookingTransitions,
  isAllowedBookingTransition,
  isBookingDueToday,
  isBookingOverdue,
} from "@/features/bookings/status";
import {
  bookingCreateSchema,
  isBookingReference,
  parseBookingListParams,
} from "@/features/bookings/validation";

describe("booking domain", () => {
  it("parses user money input into integer minor units", () => {
    expect(parseMoneyToMinorUnits("45,000")).toBe(4_500_000);
    expect(parseMoneyToMinorUnits("45000.50")).toBe(4_500_050);
    expect(parseMoneyToMinorUnits("45.999")).toBeNull();
    expect(parseMoneyToMinorUnits("-1")).toBeNull();
  });

  it("derives balances without storing a mutable balance", () => {
    expect(deriveBalanceMinor(4_500_000, 500_000)).toBe(4_000_000);
    expect(formatMoneyMinor(4_500_000, "NGN")).toBe("₦45,000");
  });

  it("validates booking forms and rejects impossible financial state", () => {
    const parsed = bookingCreateSchema.safeParse({
      customerId: "00000000-0000-4000-8000-000000000001",
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "50000",
      scheduledFor: new Date().toISOString(),
    });

    expect(parsed.success).toBe(false);
  });

  it("defines the Phase 7 status transition graph", () => {
    expect(getAllowedBookingTransitions("DRAFT")).toEqual(["CANCELLED"]);
    expect(getAllowedBookingTransitions("AWAITING_CUSTOMER")).toEqual(["CANCELLED"]);
    expect(getAllowedBookingTransitions("CONFIRMED")).toEqual(["IN_PROGRESS", "CANCELLED"]);
    expect(getAllowedBookingTransitions("IN_PROGRESS")).toEqual(["READY", "CANCELLED"]);
    expect(getAllowedBookingTransitions("READY")).toEqual(["DELIVERED", "CANCELLED"]);
    expect(getAllowedBookingTransitions("DELIVERED")).toEqual(["COMPLETED"]);
    expect(isAllowedBookingTransition("DRAFT", "CONFIRMED")).toBe(false);
    expect(isAllowedBookingTransition("CONFIRMED", "DELIVERED")).toBe(false);
    expect(isAllowedBookingTransition("READY", "COMPLETED")).toBe(false);
    expect(isAllowedBookingTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(isAllowedBookingTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("derives overdue state without storing it as a status", () => {
    expect(
      isBookingOverdue({
        scheduledFor: "2026-08-17T12:00:00.000Z",
        status: "CONFIRMED",
        now: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isBookingOverdue({
        scheduledFor: "2026-08-17T12:00:00.000Z",
        status: "AWAITING_CUSTOMER",
        now: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isBookingOverdue({
        scheduledFor: "2026-08-17T12:00:00.000Z",
        status: "COMPLETED",
        now: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("derives due-today state without storing it as a status", () => {
    expect(
      isBookingDueToday({
        scheduledFor: "2026-08-18T10:30:00.000Z",
        now: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isBookingDueToday({
        scheduledFor: "2026-08-19T10:30:00.000Z",
        now: new Date("2026-08-18T12:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("parses list filters and validates booking reference format", () => {
    expect(
      parseBookingListParams({
        q: "MC",
        filter: "today",
        page: "2",
        limit: "25",
      }),
    ).toEqual({ q: "MC", filter: "today", page: 2, limit: 25 });
    expect(isBookingReference("MC-260818-7A3F2B")).toBe(true);
    expect(isBookingReference("booking-1")).toBe(false);
  });
});
