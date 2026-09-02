import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingForm } from "@/components/forms/booking-form";
import { initialBookingActionState } from "@/features/bookings/action-state";

const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "A deliberately long customer name that must remain readable",
  email: "customer@example.com",
  phone: "+353 1 555 0101",
};

function renderCreateForm(action = vi.fn(async () => initialBookingActionState)) {
  render(
    <BookingForm
      action={action}
      submitLabel="Create booking"
      mode="create"
      customers={[customer]}
    />,
  );
  return action;
}

describe("BookingForm mobile create presentation", () => {
  it("starts with an unmistakable existing-customer mode and expected sections", () => {
    renderCreateForm();

    const existing = screen.getByRole("button", { name: "Use existing customer" });
    const addNew = screen.getByRole("button", { name: "Add new customer" });

    expect(existing).toHaveAttribute("aria-pressed", "true");
    expect(existing).toHaveClass("bg-primary", "text-primary-foreground");
    expect(addNew).toHaveAttribute("aria-pressed", "false");
    expect(addNew).toHaveClass("bg-card", "text-foreground");
    expect(screen.getByLabelText("Search existing customers")).toBeVisible();
    expect(screen.getByText("Choose a customer")).toBeVisible();
    expect(screen.queryByLabelText("Customer name")).toBeNull();

    for (const heading of [
      "Booking details",
      "Work information",
      "Schedule & amounts",
      "Internal notes",
      "Summary",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  it("switches modes without submitting or clearing unrelated booking values", () => {
    const action = renderCreateForm();
    fireEvent.change(screen.getByLabelText("Booking title"), {
      target: { value: "Website redesign" },
    });
    fireEvent.change(screen.getByLabelText("Agreed total"), {
      target: { value: "45000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add new customer" }));
    expect(screen.getByRole("button", { name: "Add new customer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Add new customer" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
    expect(screen.queryByLabelText("Search existing customers")).toBeNull();
    expect(screen.getByLabelText("Customer name")).toBeVisible();
    expect(screen.getByLabelText("Saved contact email (optional)")).toHaveAttribute(
      "placeholder",
      "Add a saved contact email",
    );
    expect(
      screen.getByText(
        "You can add this later if the customer does not have an email available now.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Saved contact email (optional)")).not.toBeRequired();
    expect(screen.getByLabelText("Booking title")).toHaveValue("Website redesign");
    expect(screen.getByLabelText("Agreed total")).toHaveValue("45000");
    expect(action).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "New customer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use existing customer" }));
    expect(screen.getByRole("button", { name: "Use existing customer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Search existing customers")).toBeVisible();
    expect(screen.queryByLabelText("Customer name")).toBeNull();
    expect(screen.getByLabelText("Booking title")).toHaveValue("Website redesign");
    expect(screen.getByLabelText("Agreed total")).toHaveValue("45000");
    expect(action).not.toHaveBeenCalled();
  });

  it("updates the local summary without invoking the server action", () => {
    const action = renderCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Add new customer" }));
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText("Booking title"), {
      target: { value: "Product launch" },
    });
    fireEvent.change(screen.getByLabelText("Scheduled delivery date"), {
      target: { value: "2026-09-15T14:30" },
    });
    fireEvent.change(screen.getByLabelText("Agreed total"), {
      target: { value: "1250.50" },
    });
    fireEvent.change(screen.getByLabelText("Deposit recorded"), {
      target: { value: "250" },
    });

    const summary = document.querySelector("[data-booking-summary]");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("Ada Lovelace")).toBeVisible();
    expect(within(summary as HTMLElement).getByText("Product launch")).toBeVisible();
    expect(within(summary as HTMLElement).getByText("NGN 1250.50")).toBeVisible();
    expect(within(summary as HTMLElement).getByText("NGN 250")).toBeVisible();
    expect(within(summary as HTMLElement).queryByText("—")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("uses the approved field copy and an accurate confirmation-rule note", () => {
    renderCreateForm();

    expect(screen.getByLabelText("Booking title")).toHaveAttribute(
      "placeholder",
      "e.g. Website redesign",
    );
    expect(screen.getByLabelText("Description")).toHaveAttribute(
      "placeholder",
      "Describe the agreed work...",
    );
    expect(screen.getByLabelText("Internal notes")).toHaveAttribute(
      "placeholder",
      "Add any internal notes...",
    );
    expect(screen.getByText("Only visible to your business.")).toBeVisible();
    expect(screen.getByText(/Confirmed customer terms continue to follow/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Create booking" })).toHaveClass(
      "w-full",
      "bg-primary",
      "text-primary-foreground",
    );
  });
});
