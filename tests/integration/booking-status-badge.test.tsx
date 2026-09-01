import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BookingStatusBadge,
  getBookingStatusBadgeClassName,
} from "@/components/bookings/booking-status-badge";
import type { BookingStatus } from "@/features/bookings/status";

describe("booking status badge", () => {
  it("uses a distinct bounded treatment for every lifecycle state", () => {
    const statuses: BookingStatus[] = [
      "DRAFT",
      "AWAITING_CUSTOMER",
      "CONFIRMED",
      "IN_PROGRESS",
      "READY",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ];

    const treatments = statuses.map((status) =>
      getBookingStatusBadgeClassName(status),
    );

    expect(new Set(treatments).size).toBe(statuses.length);
    expect(getBookingStatusBadgeClassName("COMPLETED")).toContain("#f0fdf4");
    expect(getBookingStatusBadgeClassName("IN_PROGRESS")).toContain("bg-primary/10");
    expect(getBookingStatusBadgeClassName("READY")).toContain("#eff6ff");
    expect(getBookingStatusBadgeClassName("DRAFT", true)).toContain("#fef2f2");
  });

  it("always renders a human-readable status label", () => {
    const { rerender } = render(<BookingStatusBadge status="AWAITING_CUSTOMER" />);
    expect(screen.getByText("Awaiting customer")).toBeVisible();

    rerender(<BookingStatusBadge status="READY" />);
    expect(screen.getByText("Ready for delivery")).toBeVisible();

    rerender(<BookingStatusBadge status="DRAFT" overdue />);
    expect(screen.getByText("Overdue")).toBeVisible();
  });
});
