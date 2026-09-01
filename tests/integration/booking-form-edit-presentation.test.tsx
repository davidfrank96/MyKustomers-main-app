import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import { BookingForm } from "@/components/forms/booking-form";
import type { BookingActionState } from "@/features/bookings/action-state";

type EditBookingAction = (
  previousState: BookingActionState,
  formData: FormData,
) => Promise<BookingActionState>;

const initialValues = {
  title: "Macbook pro",
  description: "Buying her a new laptop",
  currency: "NGN",
  totalAmount: "50000.00",
  depositAmount: "30000.00",
  scheduledFor: "2030-09-01T14:30:00.000Z",
  internalNotes: "Private business note",
};

function renderEditBooking({
  action = vi.fn<EditBookingAction>(async () => ({ status: "idle" })),
  disabled = false,
  scheduledDisabled = false,
  materialDisabled = false,
  submitLabel = materialDisabled ? "Save internal notes" : "Save booking",
}: {
  action?: EditBookingAction;
  disabled?: boolean;
  scheduledDisabled?: boolean;
  materialDisabled?: boolean;
  submitLabel?: string;
} = {}) {
  return render(
    <BookingDetailSection
      id="booking-details"
      title={materialDisabled ? "Customer-confirmed details" : "Edit booking"}
      summary="MC-260830-E313EC • Sep 1, 2030, 3:30 PM"
      icon="edit"
      defaultOpen
    >
      <BookingForm
        action={action}
        submitLabel={submitLabel}
        mode="edit"
        disabled={disabled}
        scheduledDisabled={scheduledDisabled}
        materialDisabled={materialDisabled}
        initialValues={initialValues}
      />
    </BookingDetailSection>,
  );
}

describe("BookingForm edit presentation", () => {
  it("renders the populated compact edit surface inside an accessible accordion", () => {
    renderEditBooking();

    const trigger = screen.getByRole("button", { name: /Edit booking/ });
    expect(trigger).toHaveTextContent("MC-260830-E313EC • Sep 1, 2030, 3:30 PM");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "Update the details for this booking. Changes are private to your business.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Booking title")).toHaveValue("Macbook pro");
    expect(screen.getByLabelText("Description")).toHaveValue("Buying her a new laptop");
    expect(screen.getByLabelText("Currency")).toHaveTextContent("NGN");
    expect(screen.getByLabelText("Scheduled delivery date")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("Agreed total")).toHaveValue("50000.00");
    expect(screen.getByLabelText("Deposit recorded")).toHaveValue("30000.00");
    expect(screen.getByLabelText("Internal notes")).toHaveValue("Private business note");
    expect(screen.getByText("Only visible to your business.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save booking" })).toHaveClass(
      "w-full",
      "bg-primary",
      "text-primary-foreground",
    );

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Booking title")).not.toBeVisible();
  });

  it("submits the existing field contract and UTC schedule payload unchanged", async () => {
    const action = vi.fn<EditBookingAction>(async () => ({
      status: "success",
      message: "Booking updated.",
    }));
    renderEditBooking({ action });
    const localSchedule = "2030-09-02T16:45";

    fireEvent.change(screen.getByLabelText("Booking title"), {
      target: { value: "Updated laptop order" },
    });
    fireEvent.change(screen.getByLabelText("Scheduled delivery date"), {
      target: { value: localSchedule },
    });
    fireEvent.change(screen.getByLabelText("Internal notes"), {
      target: { value: "Updated private note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("title")).toBe("Updated laptop order");
    expect(formData?.get("description")).toBe("Buying her a new laptop");
    expect(formData?.get("currency")).toBe("NGN");
    expect(formData?.get("totalAmount")).toBe("50000.00");
    expect(formData?.get("depositAmount")).toBe("30000.00");
    expect(formData?.get("internalNotes")).toBe("Updated private note");
    expect(formData?.get("scheduledFor")).toBe(new Date(localSchedule).toISOString());
    expect(formData?.get("scheduledForLocal")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("Booking updated.");
  });

  it("preserves the separate confirmed-schedule restriction", () => {
    renderEditBooking({ scheduledDisabled: true });

    expect(screen.getByLabelText("Scheduled delivery date")).toBeDisabled();
    expect(
      screen.getByText(
        "Use reschedule to change this date after customer confirmation starts.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Booking title")).toBeEnabled();
    expect(screen.getByLabelText("Internal notes")).toBeEnabled();
  });

  it("keeps customer-confirmed material terms locked while notes remain editable", () => {
    renderEditBooking({ materialDisabled: true });

    for (const field of [
      "Booking title",
      "Description",
      "Currency",
      "Scheduled delivery date",
      "Agreed total",
      "Deposit recorded",
    ]) {
      expect(screen.getByLabelText(field)).toBeDisabled();
    }
    expect(screen.getByLabelText("Internal notes")).toBeEnabled();
    expect(
      screen.getByText(
        "Update the internal notes for this booking. Notes are private to your business.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save internal notes" })).toBeVisible();
    expect(document.querySelector('input[name="scheduledFor"]')).toBeNull();
  });

  it("associates existing server validation errors with their fields", async () => {
    const action = vi.fn<EditBookingAction>(async () => ({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        title: ["Enter a booking title."],
        totalAmount: ["Enter a valid agreed total."],
      },
    }));
    renderEditBooking({ action });

    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the highlighted fields.",
    );
    expect(screen.getByText("Enter a booking title.")).toBeVisible();
    expect(screen.getByText("Enter a valid agreed total.")).toBeVisible();
    expect(screen.getByLabelText("Booking title")).toHaveAttribute(
      "aria-describedby",
      "title-error",
    );
    expect(screen.getByLabelText("Agreed total")).toHaveAttribute(
      "aria-describedby",
      "total-error",
    );
  });

  it("keeps a pending save stable and prevents duplicate submission", async () => {
    let resolveAction: ((state: BookingActionState) => void) | undefined;
    const action = vi.fn<EditBookingAction>(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderEditBooking({ action });

    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));

    const pendingButton = await screen.findByRole("button", { name: "Please wait..." });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(action).toHaveBeenCalledTimes(1);

    resolveAction?.({ status: "success", message: "Booking updated." });
    expect(await screen.findByRole("status")).toHaveTextContent("Booking updated.");
  });

  it("remains fully read-only for completed or cancelled bookings", () => {
    renderEditBooking({ disabled: true });

    expect(screen.getByLabelText("Booking title")).toBeDisabled();
    expect(screen.getByLabelText("Internal notes")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
    expect(
      screen.queryByText(
        "Update the details for this booking. Changes are private to your business.",
      ),
    ).toBeNull();
  });
});
