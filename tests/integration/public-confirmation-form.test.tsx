import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import {
  initialPublicConfirmationActionState,
  type PublicConfirmationActionState,
} from "@/features/confirmation-links/public-action-state";

describe("public confirmation contact guidance", () => {
  it("labels the required email and explains its booking-specific purpose", () => {
    render(
      <PublicConfirmationForm
        action={vi.fn(async () => initialPublicConfirmationActionState)}
      />,
    );

    const email = screen.getByLabelText("Email address");
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("placeholder", "you@example.com");
    expect(
      screen.getByText(
        "Please enter a valid email address where we can send updates about this booking.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Phone number (optional)")).not.toBeRequired();
    expect(screen.getByLabelText("Phone number (optional)")).toHaveAttribute(
      "placeholder",
      "e.g. 0803 123 4567",
    );
    expect(screen.getByRole("heading", { name: "Your contact details" })).toBeVisible();
    expect(screen.getByText("You're in control")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeVisible();
  });

  it("preserves valid email submission with an optional empty phone", async () => {
    const action = vi.fn(
      async (_previous: PublicConfirmationActionState, submitted: FormData) => {
        expect(submitted.get("contact_email")).toBe("customer@example.com");
        expect(submitted.get("contact_phone")).toBe("");
        return initialPublicConfirmationActionState;
      },
    );
    render(<PublicConfirmationForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "customer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
