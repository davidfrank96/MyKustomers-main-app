import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingForm } from "@/components/forms/booking-form";
import { initialBookingActionState } from "@/features/bookings/action-state";

const action = async () => initialBookingActionState;

describe("BookingForm entry clarity", () => {
  it("starts new money entry empty and identifies the delivery schedule", () => {
    render(
      <BookingForm
        action={action}
        submitLabel="Create booking"
        mode="create"
        defaultCustomerMode="new"
      />,
    );

    expect(screen.getByLabelText("Scheduled delivery date")).toBeInTheDocument();
    expect(screen.getByLabelText("Agreed total")).toHaveValue("");
    expect(screen.getByLabelText("Agreed total")).toHaveAttribute(
      "placeholder",
      "Enter amount",
    );
    expect(screen.getByLabelText("Deposit recorded")).toHaveValue("");
    expect(screen.getByLabelText("Deposit recorded")).toHaveAttribute(
      "placeholder",
      "Optional",
    );
    expect(screen.getByLabelText("Deposit recorded")).not.toBeRequired();
    expect(screen.getByLabelText("Saved contact email (optional)")).toHaveValue("");
    expect(screen.getByLabelText("Saved contact email (optional)")).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });

  it("preserves persisted money values when editing", () => {
    render(
      <BookingForm
        action={action}
        submitLabel="Save booking"
        mode="edit"
        initialValues={{ totalAmount: "45000.00", depositAmount: "5000.00" }}
      />,
    );

    expect(screen.getByLabelText("Agreed total")).toHaveValue("45000.00");
    expect(screen.getByLabelText("Deposit recorded")).toHaveValue("5000.00");
  });
});
