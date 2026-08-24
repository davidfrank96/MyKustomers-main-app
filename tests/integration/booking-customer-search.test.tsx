import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingForm } from "@/components/forms/booking-form";
import { initialBookingActionState } from "@/features/bookings/action-state";

describe("BookingForm customer search", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows debounced candidates and preserves unrelated booking fields", () => {
    vi.useFakeTimers();
    render(
      <BookingForm
        action={async () => initialBookingActionState}
        submitLabel="Create booking"
        mode="create"
        customers={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Sarah Murphy",
            email: "sarah@example.com",
            phone: "+353 1 555 0101",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "David Kelly",
            email: "david@example.com",
            phone: null,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Booking title"), {
      target: { value: "Wedding cake" },
    });
    const search = screen.getByLabelText("Search existing customers");
    for (const query of ["S", "Sa", "Sar"]) {
      fireEvent.change(search, { target: { value: query } });
    }

    expect(screen.queryByRole("listbox", { name: "Matching active customers" })).toBeNull();
    act(() => vi.advanceTimersByTime(300));

    const candidate = screen.getByRole("option", { name: /Sarah Murphy/ });
    expect(candidate).toBeVisible();
    expect(screen.queryByRole("option", { name: /David Kelly/ })).toBeNull();
    expect(screen.getByLabelText("Booking title")).toHaveValue("Wedding cake");

    fireEvent.click(candidate);
    expect(candidate).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Booking title")).toHaveValue("Wedding cake");

    fireEvent.click(
      screen.getByRole("button", { name: "Clear existing customer search" }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("listbox", { name: "Matching active customers" })).toBeNull();
    expect(screen.getByLabelText("Booking title")).toHaveValue("Wedding cake");
  });
});
