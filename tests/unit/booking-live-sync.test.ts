import { describe, expect, it } from "vitest";
import {
  createBookingLiveState,
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
});
