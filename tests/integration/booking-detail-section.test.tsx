import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BookingDetailSection,
  BookingDetailSections,
} from "@/components/bookings/booking-detail-section";

describe("booking detail section", () => {
  it("exposes an accessible default-open section that the user can close", () => {
    const { rerender } = render(
      <BookingDetailSection
        id="customer-confirmation"
        title="Customer confirmation"
        summary="Awaiting customer confirmation"
        defaultOpen
      >
        <p>Confirmation controls</p>
      </BookingDetailSection>,
    );

    const trigger = screen.getByRole("button", { name: /Customer confirmation/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region")).toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Confirmation controls")).not.toBeVisible();

    rerender(
      <BookingDetailSection
        id="customer-confirmation"
        title="Customer confirmation"
        summary="Customer confirmed"
        defaultOpen
      >
        <p>Confirmation controls</p>
      </BookingDetailSection>,
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("allows secondary sections to open independently", () => {
    render(
      <>
        <BookingDetailSection
          id="booking-details"
          title="Booking details"
          summary="Reference and delivery"
        >
          <p>Booking fields</p>
        </BookingDetailSection>
        <BookingDetailSection
          id="operational-timeline"
          title="Operational timeline"
          summary="3 events"
        >
          <p>Timeline events</p>
        </BookingDetailSection>
      </>,
    );

    const details = screen.getByRole("button", { name: /Booking details/ });
    const timeline = screen.getByRole("button", { name: /Operational timeline/ });
    fireEvent.click(details);
    fireEvent.click(timeline);

    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(timeline).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Booking fields")).toBeVisible();
    expect(screen.getByText("Timeline events")).toBeVisible();
  });

  it("opens a section targeted by a journey anchor", async () => {
    window.history.replaceState(null, "", "#booking-payments");
    render(
      <BookingDetailSections>
        <BookingDetailSection
          id="booking-payments"
          title="Payment & completion"
          summary="Amount outstanding"
        >
          <p>Payment controls</p>
        </BookingDetailSection>
      </BookingDetailSections>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Payment & completion/ }),
      ).toHaveAttribute("aria-expanded", "true"),
    );
    expect(screen.getByText("Payment controls")).toBeVisible();
    window.history.replaceState(null, "", "/");
  });
});
