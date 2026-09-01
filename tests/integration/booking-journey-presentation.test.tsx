import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingJourney } from "@/components/bookings/booking-journey";
import type { BookingJourneyState } from "@/features/bookings/journey";
import type { BookingStatus } from "@/features/bookings/status";

const readyJourney: BookingJourneyState = {
  status: "READY",
  title: "Ready for delivery",
  description: "The order is prepared for delivery or collection.",
  primaryAction: {
    kind: "transition",
    toStatus: "DELIVERED",
    label: "Mark as delivered",
    pendingLabel: "Marking as delivered...",
    description: "Mark it as delivered once the customer receives the order.",
  },
  waitingReason: null,
  attention: [],
  complete: false,
  stages: [
    { key: "created", label: "Booking created", state: "completed" },
    { key: "confirmation", label: "Customer confirmed", state: "completed" },
    { key: "work", label: "Work started", state: "completed" },
    { key: "ready", label: "Ready for delivery", state: "current" },
    { key: "delivered", label: "Delivered", state: "upcoming" },
    { key: "completed", label: "Payment & completion", state: "upcoming" },
    { key: "feedback", label: "Feedback", state: "upcoming" },
  ],
};

const idleCompletionAction = vi.fn(async () => ({ status: "idle" as const }));

function renderJourney({
  journey = readyJourney,
  transitionAction = vi.fn(async () => undefined),
}: {
  journey?: BookingJourneyState;
  transitionAction?: (toStatus: BookingStatus, formData: FormData) => Promise<void>;
} = {}) {
  return render(
    <BookingJourney
      journey={journey}
      transitionAction={transitionAction}
      completionAction={idleCompletionAction}
      canCancel
      cancellationReasonRequired
      canReschedule
      canAmend
      canAdd
      cancelledAt={null}
      cancellationReason={null}
    />,
  );
}

describe("booking journey presentation", () => {
  it("keeps the authoritative current action and lifecycle stages visible", () => {
    renderJourney();

    expect(
      screen.getByRole("heading", { name: "Ready for delivery", level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByText("The order is prepared for delivery or collection."),
    ).toBeVisible();
    expect(screen.getByText("What to do next")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark as delivered" })).toBeVisible();

    const progress = screen.getByRole("list", { name: "Booking progress" });
    expect(within(progress).getByText("Booking created")).toBeVisible();
    expect(within(progress).getAllByText("Completed")).toHaveLength(3);
    expect(within(progress).getByText("Current")).toBeVisible();
    expect(within(progress).getAllByText("Upcoming")).toHaveLength(3);
    expect(
      within(progress).getByText("Ready for delivery").closest("li"),
    ).toHaveAttribute("aria-current", "step");
  });

  it("preserves every supported child action under Other actions", () => {
    renderJourney();

    const disclosure = screen.getByText("Other actions").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Other actions"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Reschedule" })).toHaveAttribute(
      "href",
      "#reschedule",
    );
    expect(screen.getByRole("link", { name: "Propose changes" })).toHaveAttribute(
      "href",
      "#booking-changes",
    );
    expect(screen.getByRole("link", { name: "Add to booking" })).toHaveAttribute(
      "href",
      "#booking-addons",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByRole("dialog", { name: "Cancel this booking?" })).toBeVisible();
  });

  it("retains disabled duplicate-submit protection and pending feedback", async () => {
    let finishTransition: (() => void) | undefined;
    const transitionAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTransition = resolve;
        }),
    );
    renderJourney({ transitionAction });

    fireEvent.click(screen.getByRole("button", { name: "Mark as delivered" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Marking as delivered...",
    });
    expect(pendingButton).toBeDisabled();
    expect(transitionAction).toHaveBeenCalledTimes(1);

    await act(async () => finishTransition?.());
  });
});
