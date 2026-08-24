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

  it("uses the same zero-argument context key in layout and page renders", () => {
    expect(dashboardLayout).toContain("getCurrentBusinessContext()");
    expect(dashboardLayout).not.toContain("getCurrentBusinessContext(user)");
  });
});
