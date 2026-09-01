import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import {
  BookingOperationalProgress,
  type OperationalProgressTimestamp,
} from "@/components/bookings/booking-operational-progress";

const unavailable: OperationalProgressTimestamp = {
  value: null,
  displayValue: "Not scheduled",
};

function renderProgress(
  overrides: Partial<Parameters<typeof BookingOperationalProgress>[0]> = {},
) {
  return render(
    <BookingDetailSection
      id="operational-progress"
      title="Operational progress"
      summary="Awaiting customer"
      icon="progress"
      defaultOpen
    >
      <BookingOperationalProgress
        started={unavailable}
        ready={unavailable}
        delivered={unavailable}
        completed={unavailable}
        cancelled={unavailable}
        {...overrides}
      />
    </BookingDetailSection>,
  );
}

describe("booking operational progress", () => {
  it("renders the fixed lifecycle stages and intentional missing-time states", () => {
    renderProgress();

    expect(
      screen.getByRole("button", { name: /Operational progress/ }),
    ).toHaveTextContent("Awaiting customer");
    const timeline = screen.getByRole("list", {
      name: "Booking operational progress",
    });
    for (const label of ["Started", "Ready", "Delivered", "Completed", "Cancelled"]) {
      expect(within(timeline).getByText(label)).toBeVisible();
    }
    expect(within(timeline).getAllByText("Not scheduled")).toHaveLength(5);
  });

  it("preserves existing formatted timestamps as readable time values", () => {
    renderProgress({
      started: {
        value: "2026-08-30T04:42:00.000Z",
        displayValue: "Aug 30, 2026, 5:42 AM",
      },
      ready: {
        value: "2026-08-30T05:30:00.000Z",
        displayValue: "Aug 30, 2026, 6:30 AM",
      },
      delivered: {
        value: "2026-08-30T06:15:00.000Z",
        displayValue: "Aug 30, 2026, 7:15 AM",
      },
      completed: {
        value: "2026-08-30T07:00:00.000Z",
        displayValue: "Aug 30, 2026, 8:00 AM",
      },
    });

    const started = screen.getByText("Aug 30, 2026, 5:42 AM");
    expect(started.tagName).toBe("TIME");
    expect(started).toHaveAttribute("datetime", "2026-08-30T04:42:00.000Z");
    expect(screen.getAllByText("Not scheduled")).toHaveLength(1);
  });

  it("marks an authoritative cancellation timestamp without hiding prior stages", () => {
    renderProgress({
      started: {
        value: "2026-08-30T04:42:00.000Z",
        displayValue: "Aug 30, 2026, 5:42 AM",
      },
      cancelled: {
        value: "2026-08-30T05:00:00.000Z",
        displayValue: "Aug 30, 2026, 6:00 AM",
      },
    });

    expect(screen.getByText("Started")).toBeVisible();
    const cancelled = screen.getByText("Cancelled").closest("li");
    expect(cancelled).toHaveAttribute("data-state", "cancelled");
    expect(
      within(cancelled! as HTMLElement).getByText("Aug 30, 2026, 6:00 AM"),
    ).toBeVisible();
  });

  it("retains accessible accordion expansion and collapse behavior", () => {
    renderProgress();

    const trigger = screen.getByRole("button", { name: /Operational progress/ });
    const region = screen.getByRole("region");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(region).toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(region).not.toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
