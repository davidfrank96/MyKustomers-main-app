import fs from "node:fs";
import { describe, expect, it } from "vitest";

const authServer = fs.readFileSync("lib/auth/server.ts", "utf8");
const dashboardLayout = fs.readFileSync("app/(dashboard)/layout.tsx", "utf8");

describe("request-scoped tenant context policy", () => {
  it("memoizes auth, memberships, and current business only through React request cache", () => {
    expect(authServer).toContain('import { cache } from "react"');
    expect(authServer).toMatch(/getAuthenticatedUser = cache\(/);
    expect(authServer).toMatch(/getBusinessMemberships = cache\(/);
    expect(authServer).toMatch(/getCurrentBusinessContext = cache\(/);
    expect(authServer).not.toMatch(/unstable_cache|"use cache"|'use cache'/);
  });

  it("uses the centralized zero-argument request-scoped workspace gate", () => {
    expect(dashboardLayout).toContain('requireVendorWorkspace("/dashboard")');
    expect(authServer).toContain("getCurrentBusinessContext()");
    expect(authServer).toContain("requireUser(next)");
    expect(authServer).not.toContain("getCurrentBusinessContext(user)");
    expect(dashboardLayout).not.toContain("getCurrentBusinessContext(user)");
  });

  it("resolves memberships and business summaries through one RLS-scoped relation read", () => {
    expect(authServer).toContain("businesses!business_members_business_id_fkey");
    expect(authServer).toContain('.from("business_members")');
    expect(authServer).toContain('.eq("user_id", user.id)');
    expect(authServer).not.toContain("const businessById = new Map");
  });
});
