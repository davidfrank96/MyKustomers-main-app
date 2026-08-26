import { describe, expect, it } from "vitest";
import {
  deriveBalanceMinor,
  formatMoneyMinor,
  parseMoneyToMinorUnits,
} from "@/features/bookings/money";
import {
  areMaterialBookingTermsLocked,
  getAllowedBookingTransitions,
  hasCustomerConfirmedTerms,
  isAllowedBookingTransition,
  isBookingDueToday,
  isBookingOverdue,
} from "@/features/bookings/status";
import {
  bookingCreateSchema,
  bookingPaymentSchema,
  bookingTransitionSchema,
  isBookingReference,
  parseBookingListParams,
} from "@/features/bookings/validation";
import {
  hasMaterialBookingFieldChange,
  materialBookingFields,
  nonMaterialBookingFields,
} from "@/features/confirmation-links/terms";

describe("booking domain", () => {
  it("parses user money input into integer minor units", () => {
    expect(parseMoneyToMinorUnits("45,000")).toBe(4_500_000);
    expect(parseMoneyToMinorUnits("45000.50")).toBe(4_500_050);
    expect(parseMoneyToMinorUnits("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMoneyToMinorUnits("45.999")).toBeNull();
    expect(parseMoneyToMinorUnits("-1")).toBeNull();
  });

  it("derives balances without storing a mutable balance", () => {
    expect(deriveBalanceMinor(4_500_000, 500_000)).toBe(4_000_000);
    expect(formatMoneyMinor(4_500_000, "NGN")).toBe("₦45,000");
  });

  it("validates positive payment amounts and idempotent operation identifiers", () => {
    const operationId = "00000000-0000-4000-8000-000000000001";

    expect(
      bookingPaymentSchema.parse({ amount: "1,250.50", operationId }),
    ).toEqual({ amount: 125_050, operationId });
    expect(bookingPaymentSchema.safeParse({ amount: "0", operationId }).success).toBe(
      false,
    );
    expect(bookingPaymentSchema.safeParse({ amount: "-1", operationId }).success).toBe(
      false,
    );
    expect(
      bookingPaymentSchema.safeParse({ amount: "10", operationId: "forged" }).success,
    ).toBe(false);
  });

  it("validates booking forms and rejects impossible financial state", () => {
    const parsed = bookingCreateSchema.safeParse({
      customerMode: "existing",
      customerId: "00000000-0000-4000-8000-000000000001",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "50000",
      scheduledFor: new Date().toISOString(),
    });

    expect(parsed.success).toBe(false);
  });

  it("requires an agreed total and normalizes an empty optional deposit to zero", () => {
    const base = {
      customerMode: "existing" as const,
      customerId: "00000000-0000-4000-8000-000000000001",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN" as const,
    };
    const missingTotal = bookingCreateSchema.safeParse({
      ...base,
      totalAmount: "",
      depositAmount: "",
    });
    const optionalDeposit = bookingCreateSchema.safeParse({
      ...base,
      totalAmount: "45000",
      depositAmount: "",
    });

    expect(missingTotal.success).toBe(false);
    expect(optionalDeposit.success).toBe(true);
    if (optionalDeposit.success) {
      expect(optionalDeposit.data.depositAmount).toBe(0);
      expect(optionalDeposit.data.totalAmount).toBe(4_500_000);
    }
  });

  it("validates existing-customer booking input without new-customer fields", () => {
    const parsed = bookingCreateSchema.safeParse({
      customerMode: "existing",
      customerId: "00000000-0000-4000-8000-000000000001",
      newCustomerName: "",
      newCustomerEmail: "",
      newCustomerPhone: "",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "5000",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts and normalizes a name-only inline customer", () => {
    const parsed = bookingCreateSchema.safeParse({
      customerMode: "new",
      customerId: "",
      newCustomerName: "  Sarah Okafor  ",
      newCustomerEmail: "",
      newCustomerPhone: "",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "5000",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.customerMode === "new") {
      expect(parsed.data.newCustomerName).toBe("Sarah Okafor");
      expect(parsed.data.newCustomerEmail).toBeUndefined();
      expect(parsed.data.newCustomerPhone).toBeUndefined();
    }
  });

  it("normalizes inline contact and rejects malformed contact", () => {
    const normalized = bookingCreateSchema.safeParse({
      customerMode: "new",
      customerId: "",
      newCustomerName: "Sarah",
      newCustomerEmail: " SARAH@EXAMPLE.COM ",
      newCustomerPhone: " +353 01 555 0101 ",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "0",
    });
    const malformed = bookingCreateSchema.safeParse({
      customerMode: "new",
      customerId: "",
      newCustomerName: "Sarah",
      newCustomerEmail: "not-an-email",
      newCustomerPhone: "<script>",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "0",
    });

    expect(normalized.success).toBe(true);
    if (normalized.success && normalized.data.customerMode === "new") {
      expect(normalized.data.newCustomerEmail).toBe("sarah@example.com");
      expect(normalized.data.newCustomerPhone).toBe("+353 01 555 0101");
    }
    expect(malformed.success).toBe(false);
  });

  it("rejects contradictory customer-mode payloads", () => {
    const existingWithNewFields = bookingCreateSchema.safeParse({
      customerMode: "existing",
      customerId: "00000000-0000-4000-8000-000000000001",
      newCustomerName: "Unexpected customer",
      newCustomerEmail: "",
      newCustomerPhone: "",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "0",
    });
    const newWithExistingId = bookingCreateSchema.safeParse({
      customerMode: "new",
      customerId: "00000000-0000-4000-8000-000000000001",
      newCustomerName: "Sarah",
      newCustomerEmail: "",
      newCustomerPhone: "",
      duplicateAcknowledged: false,
      title: "Birthday cake",
      currency: "NGN",
      totalAmount: "45000",
      depositAmount: "0",
    });

    expect(existingWithNewFields.success).toBe(false);
    expect(newWithExistingId.success).toBe(false);
  });

  it("defines the Phase 7 status transition graph", () => {
    expect(getAllowedBookingTransitions("DRAFT")).toEqual(["CANCELLED"]);
    expect(getAllowedBookingTransitions("AWAITING_CUSTOMER")).toEqual(["CANCELLED"]);
    expect(getAllowedBookingTransitions("CONFIRMED")).toEqual([
      "IN_PROGRESS",
      "CANCELLED",
    ]);
    expect(getAllowedBookingTransitions("IN_PROGRESS")).toEqual(["READY", "CANCELLED"]);
    expect(getAllowedBookingTransitions("READY")).toEqual(["DELIVERED", "CANCELLED"]);
    expect(getAllowedBookingTransitions("DELIVERED")).toEqual(["COMPLETED"]);
    expect(isAllowedBookingTransition("DRAFT", "CONFIRMED")).toBe(false);
    expect(isAllowedBookingTransition("CONFIRMED", "DELIVERED")).toBe(false);
    expect(isAllowedBookingTransition("READY", "COMPLETED")).toBe(false);
    expect(isAllowedBookingTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(isAllowedBookingTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("classifies customer-agreed and internal booking fields centrally", () => {
    expect(materialBookingFields).toEqual([
      "customer_id",
      "title",
      "description",
      "currency",
      "total_amount_minor",
      "deposit_amount_minor",
      "scheduled_for",
    ]);
    expect(nonMaterialBookingFields).toEqual(["internal_notes"]);
    expect(hasMaterialBookingFieldChange(["internal_notes"])).toBe(false);
    expect(hasMaterialBookingFieldChange(["internal_notes", "title"])).toBe(true);
  });

  it("locks material terms after confirmation while retaining the explicit states", () => {
    expect(areMaterialBookingTermsLocked("DRAFT")).toBe(false);
    expect(areMaterialBookingTermsLocked("AWAITING_CUSTOMER")).toBe(false);
    expect(areMaterialBookingTermsLocked("CONFIRMED")).toBe(true);
    expect(areMaterialBookingTermsLocked("IN_PROGRESS")).toBe(true);
    expect(areMaterialBookingTermsLocked("CANCELLED")).toBe(true);
    expect(hasCustomerConfirmedTerms("CONFIRMED")).toBe(true);
    expect(hasCustomerConfirmedTerms("DELIVERED")).toBe(true);
    expect(hasCustomerConfirmedTerms("AWAITING_CUSTOMER")).toBe(false);
  });

  it("requires a bounded plain-text reason for customer-confirmed cancellation", () => {
    expect(
      bookingTransitionSchema.safeParse({
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
        cancellationReason: "  Customer changed plans.  ",
      }),
    ).toMatchObject({
      success: true,
      data: { cancellationReason: "Customer changed plans." },
    });
    expect(
      bookingTransitionSchema.safeParse({
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
      }).success,
    ).toBe(false);
    expect(
      bookingTransitionSchema.safeParse({
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
        cancellationReason: "<strong>Cancelled</strong>",
      }).success,
    ).toBe(false);
    expect(
      bookingTransitionSchema.safeParse({
        fromStatus: "DRAFT",
        toStatus: "CANCELLED",
      }).success,
    ).toBe(true);
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
