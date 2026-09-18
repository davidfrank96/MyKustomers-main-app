import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  context: vi.fn(),
  admin: vi.fn(),
  pending: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.user,
  getCurrentBusinessContext: mocks.context,
}));
vi.mock("@/lib/admin/server", () => ({ getPlatformAdmin: mocks.admin }));
vi.mock("@/features/businesses/pending-onboarding", () => ({
  getPendingBusinessOnboardingId: mocks.pending,
}));
vi.mock("@/features/businesses/actions", () => ({
  createBusinessAction: vi.fn(),
  completeBusinessOnboardingAction: vi.fn(),
}));
vi.mock("@/components/forms/business-onboarding-form", () => ({
  BusinessOnboardingForm: ({ initialState }: { initialState?: unknown }) => (
    <div>{initialState ? "Resume logo setup" : "New business form"}</div>
  ),
}));
import OnboardingPage from "@/app/(onboarding)/onboarding/page";
const business = { id: "business-a", name: "Business A", role: "owner", logoPath: null };
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user-a" });
  mocks.context.mockResolvedValue({
    memberships: [],
    businesses: [],
    pendingBusinesses: [],
    currentBusiness: null,
  });
  mocks.admin.mockResolvedValue(null);
  mocks.pending.mockResolvedValue(null);
});
describe("independent onboarding route guard", () => {
  it("requires authentication before querying business state", async () => {
    mocks.user.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("renders creation only for a verified ordinary zero-business account", async () => {
    render(await OnboardingPage());
    expect(screen.getByText("New business form")).toBeVisible();
    expect(mocks.admin).toHaveBeenCalledWith({ id: "user-a" }, true);
  });
  it("returns an existing business user to the workspace", async () => {
    mocks.context.mockResolvedValue({
      memberships: [{ businessId: business.id }],
      pendingBusinesses: [],
      currentBusiness: business,
    });
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("keeps an admin-only account out of business creation", async () => {
    mocks.admin.mockResolvedValue({
      userId: "user-a",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/admin");
  });
  it("propagates unknown membership and admin state instead of offering creation", async () => {
    mocks.context.mockRejectedValueOnce(new Error("Membership unavailable"));
    await expect(OnboardingPage()).rejects.toThrow("Membership unavailable");
    mocks.admin.mockRejectedValueOnce(new Error("Admin lookup unavailable"));
    await expect(OnboardingPage()).rejects.toThrow("Admin lookup unavailable");
  });
  it("retains pending-owner logo recovery without creating a second business", async () => {
    mocks.context.mockResolvedValue({
      memberships: [{ businessId: business.id }],
      pendingBusinesses: [business],
      currentBusiness: null,
    });
    render(await OnboardingPage());
    expect(screen.getByText("Resume logo setup")).toBeVisible();
    expect(screen.queryByText("New business form")).toBeNull();
  });
});
