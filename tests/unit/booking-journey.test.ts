import { describe, expect, it } from "vitest";
import {
  deriveBookingJourney,
  type DeriveBookingJourneyInput,
} from "@/features/bookings/journey";
import {
  bookingStatuses,
  getAllowedBookingTransitions,
  type BookingStatus,
} from "@/features/bookings/status";

function journeyFor(
  status: BookingStatus,
  overrides: Partial<DeriveBookingJourneyInput> = {},
) {
  return deriveBookingJourney({
    status,
    confirmationLinkStatus: "none",
    feedbackLinkStatus: "none",
    feedbackReceived: false,
    confirmationEverCompleted: [
      "CONFIRMED",
      "IN_PROGRESS",
      "READY",
      "DELIVERED",
      "COMPLETED",
    ].includes(status),
    started: ["IN_PROGRESS", "READY", "DELIVERED", "COMPLETED"].includes(status),
    ready: ["READY", "DELIVERED", "COMPLETED"].includes(status),
    delivered: ["DELIVERED", "COMPLETED"].includes(status),
    completed: status === "COMPLETED",
    reconfirmationRequired: false,
    pendingAmendment: false,
    awaitingAddon: false,
    outstandingAmountMinor: 0,
    ...overrides,
  });
}

describe("booking journey", () => {
  it.each([
    ["DRAFT", "Booking created", "Generate confirmation link"],
    [
      "AWAITING_CUSTOMER",
      "Waiting for customer confirmation",
      "Generate confirmation link",
    ],
    ["CONFIRMED", "Customer confirmed", "Review fulfilment status"],
    ["IN_PROGRESS", "Customer confirmed - work in progress", "Mark as ready"],
    ["READY", "Ready for delivery", "Mark as delivered"],
    ["DELIVERED", "Awaiting feedback", "Complete booking"],
    ["COMPLETED", "Booking completed", "Request feedback"],
    ["CANCELLED", "Booking cancelled", null],
  ] satisfies Array<[BookingStatus, string, string | null]>)(
    "maps %s to clear current guidance and its next action",
    (status, title, actionLabel) => {
      const journey = journeyFor(status);

      expect(journey.title).toBe(title);
      expect(journey.primaryAction?.label ?? null).toBe(actionLabel);
    },
  );

  it("only exposes transitions permitted by the authoritative status graph", () => {
    for (const status of bookingStatuses) {
      const action = journeyFor(status).primaryAction;
      if (action?.kind !== "transition") continue;

      expect(getAllowedBookingTransitions(status)).toContain(action.toStatus);
    }

    expect(journeyFor("CONFIRMED").primaryAction).toMatchObject({
      kind: "anchor",
      href: "#operational-progress",
    });
    expect(journeyFor("CONFIRMED").primaryAction).not.toMatchObject({
      toStatus: "DELIVERED",
    });
  });

  it("requires payment evidence before a delivered booking can complete", () => {
    const outstanding = journeyFor("DELIVERED", { outstandingAmountMinor: 2_500 });
    const paid = journeyFor("DELIVERED", { outstandingAmountMinor: 0 });
    const unavailable = journeyFor("DELIVERED", { outstandingAmountMinor: null });

    expect(outstanding.primaryAction).toMatchObject({
      kind: "anchor",
      href: "#booking-payments",
      label: "Record payment",
    });
    expect(paid.primaryAction).toMatchObject({
      kind: "transition",
      toStatus: "COMPLETED",
    });
    expect(unavailable.primaryAction).toBeNull();
    expect(unavailable.waitingReason).toContain("payment status");
  });

  it("leaves no valid booking state without an action or terminal explanation", () => {
    for (const status of bookingStatuses) {
      const journey = journeyFor(status);
      const hasGuidance = Boolean(journey.description && journey.title);

      expect(hasGuidance).toBe(true);
      expect(Boolean(journey.primaryAction) || journey.complete).toBe(true);
    }
  });

  it("treats feedback as a derived post-completion step", () => {
    const requested = journeyFor("COMPLETED", { feedbackLinkStatus: "active" });
    const received = journeyFor("COMPLETED", {
      feedbackLinkStatus: "submitted",
      feedbackReceived: true,
    });

    expect(requested.primaryAction?.label).toBe("Share feedback request");
    expect(requested.stages.at(-1)).toMatchObject({
      key: "feedback",
      state: "current",
    });
    expect(received.title).toBe("Feedback received");
    expect(received.primaryAction).toBeNull();
    expect(received.complete).toBe(true);
    expect(received.stages.at(-1)).toEqual({
      key: "feedback",
      label: "Feedback received",
      state: "completed",
    });
  });

  it("shows delivered feedback without hiding an outstanding payment", () => {
    const journey = journeyFor("DELIVERED", {
      feedbackLinkStatus: "submitted",
      feedbackReceived: true,
      outstandingAmountMinor: 2_500,
    });

    expect(journey.title).toBe("Feedback received");
    expect(journey.description).toContain("Payment is still outstanding");
    expect(journey.primaryAction).toMatchObject({
      kind: "anchor",
      href: "#booking-payments",
    });
    expect(journey.stages.at(-1)).toMatchObject({
      label: "Feedback received",
      state: "completed",
    });
  });

  it("returns a rescheduled booking to explicit reconfirmation guidance", () => {
    const journey = journeyFor("AWAITING_CUSTOMER", {
      confirmationEverCompleted: true,
      reconfirmationRequired: true,
      confirmationLinkStatus: "active",
    });

    expect(journey.title).toBe("Waiting for customer confirmation");
    expect(journey.description).toContain("delivery schedule changed");
    expect(journey.waitingReason).toContain("cannot start");
    expect(journey.primaryAction?.label).toBe("Share confirmation request");
    expect(journey.attention).toContainEqual(
      expect.objectContaining({ kind: "reconfirmation" }),
    );
  });

  it("surfaces amendment and add-on attention without changing canonical progress", () => {
    const journey = journeyFor("IN_PROGRESS", {
      pendingAmendment: true,
      awaitingAddon: true,
    });

    expect(journey.primaryAction).toMatchObject({
      kind: "transition",
      toStatus: "READY",
    });
    expect(journey.attention.map((item) => item.kind)).toEqual(["amendment", "addon"]);
  });

  it("shows only preserved milestones before the cancelled terminal state", () => {
    const journey = journeyFor("CANCELLED", {
      confirmationEverCompleted: true,
      started: true,
      ready: false,
      delivered: false,
      completed: false,
    });

    expect(journey.stages.map((stage) => stage.key)).toEqual([
      "created",
      "confirmation",
      "work",
      "cancelled",
    ]);
    expect(journey.stages.some((stage) => stage.state === "upcoming")).toBe(false);
    expect(journey.primaryAction).toBeNull();
    expect(journey.complete).toBe(true);
  });
});
