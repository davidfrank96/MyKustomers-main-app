import { describe, expect, it } from "vitest";
import {
  createBookingLiveState,
  didBookingBecomeCompleted,
  getBookingLiveNotification,
} from "@/features/bookings/live-sync";

function state(
  status: "AWAITING_CUSTOMER" | "CONFIRMED" | "COMPLETED",
  customerConfirmedAt: string | null,
  feedbackSubmittedAt: string | null,
) {
  return createBookingLiveState({
    status,
    updatedAt: "2026-08-26T10:00:00.000Z",
    customerConfirmedAt,
    feedbackSubmittedAt,
  });
}

describe("booking live synchronization", () => {
  it("builds stable revisions from the minimal visible state", () => {
    expect(state("CONFIRMED", "2026-08-26T10:00:00.000Z", null)).toEqual(
      state("CONFIRMED", "2026-08-26T10:00:00.000Z", null),
    );
    expect(state("AWAITING_CUSTOMER", null, null).revision).not.toBe(
      state("CONFIRMED", "2026-08-26T10:00:00.000Z", null).revision,
    );
  });

  it("prioritizes customer confirmation and feedback notifications", () => {
    expect(
      getBookingLiveNotification(
        state("AWAITING_CUSTOMER", null, null),
        state("CONFIRMED", "2026-08-26T10:01:00.000Z", null),
      ).title,
    ).toBe("Customer confirmed");
    expect(
      getBookingLiveNotification(
        state("COMPLETED", "2026-08-26T10:01:00.000Z", null),
        state(
          "COMPLETED",
          "2026-08-26T10:01:00.000Z",
          "2026-08-26T10:02:00.000Z",
        ),
      ).title,
    ).toBe("New customer feedback");
  });

  it("identifies only an authoritative transition into completed", () => {
    expect(
      didBookingBecomeCompleted(
        state("AWAITING_CUSTOMER", null, null),
        state("COMPLETED", null, null),
      ),
    ).toBe(true);
    expect(
      didBookingBecomeCompleted(
        state("COMPLETED", null, null),
        state("COMPLETED", null, "2026-08-26T10:02:00.000Z"),
      ),
    ).toBe(false);
    expect(
      didBookingBecomeCompleted(
        state("AWAITING_CUSTOMER", null, null),
        state("AWAITING_CUSTOMER", null, "2026-08-26T10:02:00.000Z"),
      ),
    ).toBe(false);
  });

  it("includes provider evidence in the existing bounded reconciliation state", () => {
    const previous = createBookingLiveState({
      status: "AWAITING_CUSTOMER",
      updatedAt: "2026-08-26T10:00:00.000Z",
      customerConfirmedAt: null,
      feedbackSubmittedAt: null,
      providerDeliveryStatus: "UNKNOWN",
      providerEventAt: null,
    });
    const current = createBookingLiveState({
      status: "AWAITING_CUSTOMER",
      updatedAt: "2026-08-26T10:00:00.000Z",
      customerConfirmedAt: null,
      feedbackSubmittedAt: null,
      providerDeliveryStatus: "DEFERRED",
      providerEventAt: "2026-08-26T10:01:00.000Z",
    });
    expect(current.revision).not.toBe(previous.revision);
    expect(getBookingLiveNotification(previous, current).title).toBe(
      "Email delivery delayed",
    );
  });
});
