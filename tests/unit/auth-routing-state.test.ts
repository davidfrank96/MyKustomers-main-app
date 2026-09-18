import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  rows: vi.fn(),
  selected: vi.fn(),
  admin: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/config/public-env", () => ({ isSupabasePublicEnvConfigured: () => true }));
vi.mock("@/lib/auth/current-business", () => ({ getSelectedBusinessId: mocks.selected }));
vi.mock("@/lib/admin/server", () => ({ getPlatformAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.claims },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => mocks.rows().then(resolve, reject),
      };
      return query;
    },
  }),
}));

import {
  getCurrentBusinessContext,
  requireVendorWorkspace,
  BusinessMembershipLookupError,
} from "@/lib/auth/server";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

function membership(id = "business-a", pending = false, role = "owner") {
  return {
    business_id: id,
    role,
    status: "active",
    businesses: {
      id,
      name: id,
      slug: id,
      category: "Professional Services",
      logo_path: null,
      onboarding_completed_at: pending
        ? "1970-01-01T00:00:00.000Z"
        : "2026-01-01T00:00:00Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({
    data: { claims: { sub: "user-a", aal: "aal1" } },
    error: null,
  });
  mocks.rows.mockResolvedValue({ data: [membership()], error: null });
  mocks.selected.mockResolvedValue(null);
  mocks.admin.mockResolvedValue(null);
});

describe("server authentication and workspace routing", () => {
  it.each(["missing", "expired", "invalid-refresh", "malformed"])(
    "sends %s sessions to login before membership resolution",
    async (state) => {
      mocks.claims.mockResolvedValue({
        data: null,
        error: state === "missing" ? null : { code: state },
      });
      await expect(requireVendorWorkspace("/bookings/booking-a")).rejects.toThrow(
        "REDIRECT:/login?next=%2Fbookings%2Fbooking-a",
      );
      expect(mocks.rows).not.toHaveBeenCalled();
    },
  );
  it("routes a verified zero-business user to onboarding", async () => {
    mocks.rows.mockResolvedValue({ data: [], error: null });
    await expect(resolvePostAuthDestination("/dashboard")).resolves.toBe("/onboarding");
  });
  it("recovers a stale business cookie without onboarding", async () => {
    mocks.selected.mockResolvedValue("deleted-business");
    await expect(requireVendorWorkspace()).resolves.toMatchObject({
      business: { id: "business-a" },
    });
  });
  it("retains a valid second business and falls back only after membership removal", async () => {
    mocks.rows.mockResolvedValue({
      data: [membership(), membership("business-b")],
      error: null,
    });
    mocks.selected.mockResolvedValue("business-b");
    expect((await getCurrentBusinessContext()).currentBusiness?.id).toBe("business-b");
    mocks.rows.mockResolvedValue({ data: [membership()], error: null });
    expect((await getCurrentBusinessContext()).currentBusiness?.id).toBe("business-a");
  });
  it.each([{ code: "500" }, { code: "timeout" }, new Error("network unavailable")])(
    "fails closed when membership authority is unknown: %s",
    async (error) => {
      mocks.rows.mockResolvedValue({ data: [], error });
      await expect(resolvePostAuthDestination("/dashboard")).rejects.toThrow(
        BusinessMembershipLookupError,
      );
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
  it("does not treat a rejected request or unresolved business join as zero memberships", async () => {
    mocks.rows.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(requireVendorWorkspace()).rejects.toThrow("network unavailable");
    mocks.rows.mockResolvedValue({
      data: [{ ...membership(), businesses: null }],
      error: null,
    });
    await expect(requireVendorWorkspace()).rejects.toThrow(BusinessMembershipLookupError);
  });
  it("routes an admin-only account to its separate administration gate", async () => {
    mocks.rows.mockResolvedValue({ data: [], error: null });
    mocks.admin.mockResolvedValue({
      userId: "user-a",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    await expect(resolvePostAuthDestination("/dashboard")).resolves.toBe("/admin");
    await expect(requireVendorWorkspace()).rejects.toThrow("REDIRECT:/admin");
  });
  it("does not send a non-owner of an unfinished business to Create business", async () => {
    mocks.rows.mockResolvedValue({
      data: [membership("pending-business", true, "member")],
      error: null,
    });
    await expect(resolvePostAuthDestination("/dashboard")).rejects.toThrow(
      BusinessMembershipLookupError,
    );
  });
  it("preserves an owner's required-logo setup recovery", async () => {
    mocks.rows.mockResolvedValue({
      data: [membership("pending-business", true)],
      error: null,
    });
    await expect(resolvePostAuthDestination("/dashboard")).resolves.toBe("/onboarding");
  });
  it.each([
    "/admin/security",
    "/c/token",
    "/a/token",
    "/f/token",
    "/x/token",
    "/reset-password",
  ])("does not apply vendor onboarding to %s", async (next) => {
    await expect(resolvePostAuthDestination(next)).resolves.toBe(next);
    expect(mocks.rows).not.toHaveBeenCalled();
  });
});
