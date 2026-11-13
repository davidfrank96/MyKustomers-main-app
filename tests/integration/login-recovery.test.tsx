import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BusinessMembershipLookupError } from "@/lib/auth/business-access";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  destination: vi.fn(),
  recovery: vi.fn(),
  capture: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/lib/auth/server", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/lib/auth/post-auth", () => ({
  resolvePostAuthDestination: mocks.destination,
  resolvePostAuthDestinationWithRecovery: mocks.recovery,
}));
vi.mock("@/features/auth/provider-status", () => ({
  isGoogleAuthEnabled: async () => false,
}));
vi.mock("@/features/auth/actions", () => ({
  loginAction: vi.fn(),
  signupAction: vi.fn(),
  resendSignupConfirmationAction: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.capture }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/forms/auth-form", () => ({
  AuthForm: () => <div>Log in form</div>,
}));
vi.mock("@/components/legal/terms-link", () => ({ TermsLink: () => null }));
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user-a", userMetadata: {} });
  mocks.destination.mockResolvedValue("/bookings");
});

it("renders a recoverable signed-in state without claiming access or showing credentials", async () => {
  mocks.destination.mockRejectedValue(
    new BusinessMembershipLookupError({ code: "PGRST002", message: "private" }),
  );
  render(await LoginPage({ searchParams: Promise.resolve({ next: "/bookings" }) }));
  expect(screen.getByRole("heading")).toHaveTextContent("couldn’t open your workspace");
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "/login?next=%2Fbookings",
  );
  expect(screen.queryByText("Log in form")).toBeNull();
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(mocks.capture).toHaveBeenCalledWith("Workspace access temporarily unavailable", {
    level: "error",
    tags: { auth_stage: "workspace_lookup", storage_code: "PGRST002" },
  });
});
it("redirects normally after a verified lookup", async () => {
  await expect(
    LoginPage({ searchParams: Promise.resolve({ next: "/bookings" }) }),
  ).rejects.toThrow("REDIRECT:/bookings");
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("keeps signed-out login available without membership reads", async () => {
  mocks.user.mockResolvedValue(null);
  render(await LoginPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Log in form")).toBeInTheDocument();
  expect(mocks.destination).not.toHaveBeenCalled();
});

it("routes signed-in signup visitors to recovery without offering a duplicate account", async () => {
  mocks.recovery.mockResolvedValue("/login?next=%2Fdashboard");
  await expect(SignupPage()).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  expect(mocks.recovery).toHaveBeenCalledWith("/dashboard", {
    id: "user-a",
    userMetadata: {},
  });
});
