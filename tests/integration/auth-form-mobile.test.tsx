import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/forms/auth-form";
import { initialAuthActionState } from "@/features/auth/action-state";

vi.mock("@/components/forms/google-auth-button", () => ({
  GoogleAuthButton: () => <button type="button">Continue with Google</button>,
}));

describe("mobile auth presentation", () => {
  it("renders the unboxed brand hierarchy and an accessible password toggle", () => {
    render(
      <AuthForm
        title="Log in"
        description="Access your My Kustomers workspace."
        action={async () => initialAuthActionState}
        submitLabel="Log in"
        presentation="mobile"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
            placeholder: "Enter your email address",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
            placeholder: "Enter your password",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "My Kustomers home" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Log in" })).toBeVisible();

    const section = screen.getByRole("heading", { name: "Log in" }).closest("section");
    expect(section).not.toHaveClass("border");
    expect(section).not.toHaveClass("shadow-sm");

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("placeholder", "Enter your password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(screen.getByRole("button", { name: "Log in" })).toHaveClass("h-14");
  });
});
