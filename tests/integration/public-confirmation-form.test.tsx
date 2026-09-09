import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicConfirmationForm } from "@/components/forms/public-confirmation-form";
import {
  initialPublicConfirmationActionState,
  type PublicConfirmationActionState,
} from "@/features/confirmation-links/public-action-state";

describe("public confirmation email review", () => {
  it("starts with accessible contact guidance and requires review before submission", () => {
    const action = vi.fn(async () => initialPublicConfirmationActionState);
    render(<PublicConfirmationForm action={action} />);

    const email = screen.getByLabelText("Email address");
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("placeholder", "you@example.com");
    expect(
      screen.getByText(
        "Please enter a valid email address where we can send updates about this booking.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Phone number (optional)")).not.toBeRequired();
    expect(screen.getByRole("heading", { name: "Your contact details" })).toBeVisible();
    expect(screen.getByText("You're in control")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review and confirm" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm booking" })).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("validates before review and focuses the malformed email field", () => {
    const action = vi.fn(async () => initialPublicConfirmationActionState);
    render(<PublicConfirmationForm action={action} />);

    const email = screen.getByLabelText("Email address");
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));

    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(email).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Confirm your email" })).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("shows and submits the exact domain-normalized booking email", async () => {
    const action = vi.fn(
      async (_previous: PublicConfirmationActionState, submitted: FormData) => {
        expect(submitted.get("contact_email")).toBe("David.Frank@hotmail.com");
        expect(submitted.get("contact_phone")).toBe("+353 01 555 0155");
        return initialPublicConfirmationActionState;
      },
    );
    render(<PublicConfirmationForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  David.Frank@HOTMAIL.COM  " },
    });
    fireEvent.change(screen.getByLabelText("Phone number (optional)"), {
      target: { value: "  +353 01 555 0155  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));

    const heading = screen.getByRole("heading", { name: "Confirm your email" });
    expect(heading).toHaveFocus();
    expect(screen.getByTestId("reviewed-email")).toHaveTextContent(
      "David.Frank@hotmail.com",
    );
    expect(screen.getByTestId("reviewed-email")).toHaveClass("break-all");
    expect(
      screen.getByText(
        "This checks the address format only, not whether the mailbox exists or can receive email.",
      ),
    ).toBeVisible();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("returns focus to the preserved form and submits a corrected email", async () => {
    const action = vi.fn(
      async (_previous: PublicConfirmationActionState, submitted: FormData) => {
        expect(submitted.get("contact_email")).toBe("corrected@example.co.uk");
        expect(submitted.get("contact_phone")).toBe("0803 123 4567");
        return initialPublicConfirmationActionState;
      },
    );
    render(<PublicConfirmationForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "wrong@example.ie" },
    });
    fireEvent.change(screen.getByLabelText("Phone number (optional)"), {
      target: { value: "0803 123 4567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit email" }));

    const email = screen.getByLabelText("Email address");
    expect(email).toHaveFocus();
    expect(email).toHaveValue("wrong@example.ie");
    expect(screen.getByLabelText("Phone number (optional)")).toHaveValue(
      "0803 123 4567",
    );

    fireEvent.change(email, { target: { value: "corrected@EXAMPLE.CO.UK" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
    expect(screen.getByTestId("reviewed-email")).toHaveTextContent(
      "corrected@example.co.uk",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("guards rapid final clicks without using browser-native dialogs", async () => {
    let finishAction: ((state: PublicConfirmationActionState) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<PublicConfirmationActionState>((resolve) => {
          finishAction = resolve;
        }),
    );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<PublicConfirmationForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "customer+booking@custom-domain.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
    const confirmButton = screen.getByRole("button", { name: "Confirm booking" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();

    finishAction?.(initialPublicConfirmationActionState);
  });

  it("renders a stable accessible success acknowledgement with the confirmed email", async () => {
    const action = vi.fn(async () => ({
      status: "success" as const,
      businessName: "Bella Cakes",
      contactEmail: "David.Frank@hotmail.com",
      alreadyConfirmed: false,
    }));
    render(<PublicConfirmationForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "David.Frank@HOTMAIL.COM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(
      await screen.findByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();
    expect(
      screen.getByText("Thank you. Your confirmation has been sent to Bella Cakes."),
    ).toBeVisible();
    expect(screen.getByTestId("confirmed-email")).toHaveTextContent(
      "David.Frank@hotmail.com",
    );
    expect(screen.getByRole("button", { name: "Done" })).toBeVisible();
    expect(screen.queryByLabelText("Close dialog")).toBeNull();
  });
});
