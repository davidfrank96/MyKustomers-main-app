import { describe, expect, it } from "vitest";
import {
  hasPlatformAdminRole,
  parsePlatformAdminAccess,
} from "@/lib/admin/access-policy";

describe("platform admin access policy", () => {
  it("accepts only the explicit active super-admin contract", () => {
    const access = parsePlatformAdminAccess({
      user_id: "9fb5934b-cba1-4aa0-9e87-feb1c0e73842",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });

    expect(access).toEqual({
      userId: "9fb5934b-cba1-4aa0-9e87-feb1c0e73842",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    expect(hasPlatformAdminRole(access!, ["SUPER_ADMIN"])).toBe(true);
  });

  it.each([
    null,
    {},
    { user_id: "user", role: "owner", status: "ACTIVE" },
    { user_id: "user", role: "SUPER_ADMIN", status: "DISABLED" },
    { user_id: 42, role: "SUPER_ADMIN", status: "ACTIVE" },
  ])("fails closed for malformed, tenant-role, or disabled records", (value) => {
    expect(parsePlatformAdminAccess(value)).toBeNull();
  });
});
