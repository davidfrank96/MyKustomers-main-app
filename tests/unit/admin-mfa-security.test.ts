import { describe, expect, it } from "vitest";
import { parseAdminMfaSecurityStatus } from "@/features/admin/security";

describe("admin MFA security status", () => {
  it("counts only verified TOTP factors as configured", () => {
    expect(
      parseAdminMfaSecurityStatus({
        currentLevel: "aal1",
        nextLevel: "aal2",
        factors: [
          {
            id: "db8ad30e-1ff7-4204-813f-01502681187f",
            factor_type: "totp",
            status: "verified",
            friendly_name: "Primary authenticator",
            created_at: "2026-08-26T12:00:00.000Z",
          },
          {
            id: "0886dfcc-cf32-446a-b7ca-48b04366f541",
            factor_type: "totp",
            status: "unverified",
          },
          {
            id: "71e13ed7-cf47-4055-ac6f-a7649b1170d1",
            factor_type: "phone",
            status: "verified",
          },
        ],
        privilegedAccessReady: false,
      }),
    ).toEqual({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedFactors: [
        {
          id: "db8ad30e-1ff7-4204-813f-01502681187f",
          friendlyName: "Primary authenticator",
          createdAt: "2026-08-26T12:00:00.000Z",
        },
      ],
      unverifiedFactorCount: 1,
      privilegedAccessReady: false,
    });
  });

  it.each([
    {
      currentLevel: "aal3",
      nextLevel: "aal2",
      factors: [],
      privilegedAccessReady: false,
    },
    {
      currentLevel: "aal1",
      nextLevel: null,
      factors: [],
      privilegedAccessReady: false,
    },
    {
      currentLevel: "aal1",
      nextLevel: "aal1",
      factors: [{ id: "not-a-uuid" }],
      privilegedAccessReady: false,
    },
    {
      currentLevel: "aal1",
      nextLevel: "aal1",
      factors: [],
      privilegedAccessReady: "yes",
    },
  ])("fails closed for malformed status data", (value) => {
    expect(parseAdminMfaSecurityStatus(value)).toBeNull();
  });
});
