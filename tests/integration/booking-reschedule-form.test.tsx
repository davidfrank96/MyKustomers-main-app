import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import { BookingRescheduleForm } from "@/components/forms/booking-reschedule-form";
import type { BookingActionState } from "@/features/bookings/action-state";

type RescheduleAction = (
  previousState: BookingActionState,
  formData: FormData,
) => Promise<BookingActionState>;

const currentScheduledFor = "2030-09-01T14:30:00.000Z";

function renderReschedule({
  action = vi.fn<RescheduleAction>(async () => ({ status: "idle" })),
  disabled = false,
  reconfirmationExpected = false,
}: {
  action?: RescheduleAction;
  disabled?: boolean;
  reconfirmationExpected?: boolean;
} = {}) {
  return render(
    <BookingDetailSection
      id="reschedule"
      title="Reschedule"
      summary="Scheduled Sep 1, 2030, 3:30 PM"
      icon="reschedule"
      defaultOpen
    >
      <BookingRescheduleForm
        action={action}
        currentScheduledFor={currentScheduledFor}
        disabled={disabled}
        reconfirmationExpected={reconfirmationExpected}
      />
    </BookingDetailSection>,
  );
}

describe("booking reschedule presentation", () => {
  it("renders the compact accordion and preserves its accessible open state", () => {
    renderReschedule();

    const trigger = screen.getByRole("button", { name: /Scheduled Sep 1, 2030/ });
    expect(trigger).toHaveTextContent("Scheduled Sep 1, 2030, 3:30 PM");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Choose a new date and time for this booking.")).toBeVisible();
    expect(screen.getByLabelText("New scheduled date")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(
      screen.getByText("Select the new date and time for this booking."),
    ).toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Choose a new date and time for this booking.")).not.toBeVisible();
  });

  it("submits the existing UTC ISO payload without changing date conversion", async () => {
    const action = vi.fn<RescheduleAction>(async () => ({ status: "idle" }));
    renderReschedule({ action });
    const localValue = "2030-09-02T16:45";

    fireEvent.change(screen.getByLabelText("New scheduled date"), {
      target: { value: localValue },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Reschedule$/ }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("scheduledFor")).toBe(new Date(localValue).toISOString());
    expect(formData?.get("rescheduledForLocal")).toBeNull();
  });

  it("associates the existing server validation error with the date field", async () => {
    const action = vi.fn<RescheduleAction>(async () => ({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { scheduledFor: ["Choose a future scheduled date."] },
    }));
    renderReschedule({ action });

    fireEvent.click(screen.getByRole("button", { name: /^Reschedule$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the highlighted fields.",
    );
    expect(screen.getByText("Choose a future scheduled date.")).toBeVisible();
    expect(screen.getByLabelText("New scheduled date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("New scheduled date")).toHaveAttribute(
      "aria-describedby",
      "reschedule-date-helper reschedule-error",
    );
  });

  it("uses truthful conditional reconfirmation and notification guidance", () => {
    const { rerender } = renderReschedule();
    expect(
      screen.getByText(
        "A reschedule email is sent only after a customer has previously confirmed the booking.",
      ),
    ).toBeVisible();

    rerender(
      <BookingDetailSection
        id="reschedule"
        title="Reschedule"
        summary="Scheduled Sep 1, 2030, 3:30 PM"
        icon="reschedule"
        defaultOpen
      >
        <BookingRescheduleForm
          action={vi.fn<RescheduleAction>(async () => ({ status: "idle" }))}
          currentScheduledFor={currentScheduledFor}
          reconfirmationExpected
        />
      </BookingDetailSection>,
    );

    expect(
      screen.getByText(
        "The customer will need to confirm the updated schedule. Email delivery is attempted using the saved confirmation address.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Customers will be notified after you reschedule.")).toBeNull();
  });

  it("keeps the existing lifecycle eligibility lock visible and effective", () => {
    renderReschedule({ disabled: true });

    expect(screen.getByLabelText("New scheduled date")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Reschedule$/ })).toBeDisabled();
  });

  it("preserves pending feedback and prevents a duplicate submission", async () => {
    let resolveAction: ((state: BookingActionState) => void) | undefined;
    const action = vi.fn<RescheduleAction>(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderReschedule({ action });

    fireEvent.click(screen.getByRole("button", { name: /^Reschedule$/ }));

    const pendingButton = await screen.findByRole("button", {
      name: "Rescheduling...",
    });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(action).toHaveBeenCalledTimes(1);

    resolveAction?.({ status: "success", message: "Booking rescheduled." });
    expect(await screen.findByRole("status")).toHaveTextContent("Booking rescheduled.");
  });
});
