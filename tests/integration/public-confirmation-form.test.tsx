import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import { initialPublicConfirmationActionState } from "@/features/confirmation-links/public-action-state";

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
  });
});
