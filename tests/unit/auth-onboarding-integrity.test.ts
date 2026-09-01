import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BusinessMembershipLookupError,
  requireBusinessAccessRows,
} from "@/lib/auth/business-access";
import { isVendorWorkspacePath, resolvePostAuthPath } from "@/lib/auth/post-auth-path";

describe("auth onboarding integrity", () => {
  it("routes zero-business users away from every vendor workspace root", () => {
    for (const path of [
      "/dashboard",
      "/bookings",
      "/bookings/new",
      "/customers",
      "/customers/customer-id",
      "/insights?range=this_month",
      "/business",
      "/business/new",
      "/settings#my-businesses",
    ]) {
      expect(isVendorWorkspacePath(path), path).toBe(true);
      expect(resolvePostAuthPath(path, false), path).toBe("/onboarding");
      expect(resolvePostAuthPath(path, true), path).toBe(path);
    }
  });

  it("does not classify onboarding, admin, auth, or public capabilities as vendor routes", () => {
    for (const path of [
      "/onboarding",
      "/admin",
      "/admin/security",
      "/reset-password",
      "/c/token",
      "/a/token",
      "/x/token",
      "/f/token",
    ]) {
      expect(isVendorWorkspacePath(path), path).toBe(false);
      expect(resolvePostAuthPath(path, false), path).toBe(path);
    }
  });

  it("keeps external and protocol-relative destinations on the safe dashboard policy", () => {
    expect(resolvePostAuthPath("https://attacker.example", false)).toBe("/onboarding");
    expect(resolvePostAuthPath("//attacker.example", false)).toBe("/onboarding");
  });

  it("distinguishes an authoritative empty result from a failed membership lookup", () => {
    expect(requireBusinessAccessRows([], null)).toEqual([]);
    expect(() => requireBusinessAccessRows(null, null)).toThrow(
      BusinessMembershipLookupError,
    );
    expect(() =>
      requireBusinessAccessRows([], new Error("database unavailable")),
    ).toThrow(BusinessMembershipLookupError);
  });

  it("enforces the shared post-auth and pre-shell server boundaries", () => {
    const callback = fs.readFileSync("app/(auth)/auth/callback/route.ts", "utf8");
    const authActions = fs.readFileSync("features/auth/actions.ts", "utf8");
    const dashboardLayout = fs.readFileSync("app/(dashboard)/layout.tsx", "utf8");
    const customerActions = fs.readFileSync("features/customers/actions.ts", "utf8");

    expect(callback).toContain("resolvePostAuthDestination");
    expect(authActions).toContain("resolvePostAuthDestination");
    expect(dashboardLayout).toContain("requireVendorWorkspace");
    expect(customerActions).toContain('requireCurrentBusiness("/customers/new")');
    expect(fs.existsSync("app/(dashboard)/onboarding/page.tsx")).toBe(false);
    expect(fs.existsSync("app/(onboarding)/onboarding/page.tsx")).toBe(true);
  });
});
