import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BookingDetailLoading from "@/app/(dashboard)/bookings/[bookingId]/loading";

describe("booking detail loading", () => {
  it("preserves an announced structural loading state aligned to the final page", () => {
    const { container } = render(<BookingDetailLoading />);
    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading booking")).toHaveClass("sr-only");
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(33);
  });
});
