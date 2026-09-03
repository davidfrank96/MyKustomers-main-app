import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("link", { name: "MyKustomers.com home" })).toBeVisible();
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

  it("uses the current brand in the desktop presentation", () => {
    render(
      <AuthForm
        title="Log in"
        description="Access your My Kustomers workspace."
        action={async () => initialAuthActionState}
        submitLabel="Log in"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
      />,
    );

    const brandLink = screen.getByRole("link", { name: "MyKustomers.com home" });
    expect(brandLink).toBeVisible();
    expect(brandLink.querySelector('img[data-brand-logo="horizontal"]')).toBeVisible();
    expect(screen.queryByText("My Customers", { exact: true })).not.toBeInTheDocument();
  });

  it("opens an accessible verification modal and keeps a persistent resend notice after dismissal", async () => {
    const email = "person+desk@example.com";
    const signup = vi.fn(async () => ({
      status: "success" as const,
      code: "verification_required" as const,
      message: "Check your email to confirm your account.",
      verification: { email, retryAfterSeconds: 0 },
    }));
    const resend = vi.fn(async () => ({
      status: "success" as const,
      code: "verification_resent" as const,
      message:
        "If this signup is awaiting confirmation, check your inbox for a new verification email.",
      retryAfterSeconds: 60,
      verification: { email, retryAfterSeconds: 60 },
    }));

    render(
      <AuthForm
        title="Create your account"
        description="Create your login."
        action={signup}
        resendVerificationAction={resend}
        submitLabel="Create account"
        presentation="mobile"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(screen.getAllByText(email)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "Verification required" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create account" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Use another email" })).toHaveAttribute(
      "href",
      "/signup",
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(resend).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(/check your inbox for a new verification email/i),
    ).toBeVisible();
  });
});
