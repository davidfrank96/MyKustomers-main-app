import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BookingOperationalTimeline,
  formatTimelineEventCount,
  type BookingTimelineEvent,
} from "@/components/bookings/booking-operational-timeline";

const events: BookingTimelineEvent[] = [
  {
    id: "status-created",
    occurredAt: "2026-08-31T13:03:00.000Z",
    title: "Created as Draft",
    detail: "Status history",
  },
  {
    id: "change-rescheduled",
    occurredAt: "2026-08-31T13:04:00.000Z",
    title: "Booking rescheduled",
    detail: "Sep 1, 2026, 2:00 PM to Sep 2, 2026, 2:00 PM",
  },
  {
    id: "addon-confirmed-example",
    occurredAt: "2026-08-31T13:05:00.000Z",
    title:
      "Booking add-on confirmed with a deliberately long descriptive title that wraps naturally",
    detail: "Priority delivery packaging",
  },
];

function formatTimestamp(value: string) {
  return `Formatted ${value}`;
}

describe("booking operational timeline", () => {
  it("renders authoritative mixed events in DOM order with titles, details, and timestamps", () => {
    render(
      <BookingOperationalTimeline events={events} formatTimestamp={formatTimestamp} />,
    );

    const timeline = screen.getByRole("list", { name: "Booking activity timeline" });
    const items = within(timeline).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText("Created as Draft")).toBeVisible();
    expect(within(items[0]!).getByText("Status history")).toBeVisible();
    expect(within(items[1]!).getByText("Booking rescheduled")).toBeVisible();
    expect(
      within(items[2]!).getByText(/deliberately long descriptive title/),
    ).toBeVisible();
    expect(within(items[2]!).getByText("Priority delivery packaging")).toBeVisible();
    expect(within(items[2]!).getByText(/^Formatted /)).toHaveAttribute(
      "datetime",
      events[2]!.occurredAt,
    );
  });

  it("omits an absent detail and preserves the safe empty state", () => {
    const { rerender } = render(
      <BookingOperationalTimeline
        events={[{ ...events[0]!, detail: null }]}
        formatTimestamp={formatTimestamp}
      />,
    );

    expect(screen.queryByText("Status history")).not.toBeInTheDocument();

    rerender(
      <BookingOperationalTimeline events={[]} formatTimestamp={formatTimestamp} />,
    );
    expect(screen.getByText("No timeline events recorded.")).toBeVisible();
    expect(
      screen.queryByText("A chronological record of key updates to this booking."),
    ).not.toBeInTheDocument();
  });

  it("formats singular and plural event counts", () => {
    expect(formatTimelineEventCount(0)).toBe("0 events");
    expect(formatTimelineEventCount(1)).toBe("1 event");
    expect(formatTimelineEventCount(6)).toBe("6 events");
  });
});
