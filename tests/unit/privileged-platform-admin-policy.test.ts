import { describe, expect, it } from "vitest";
import type { PlatformAdminAccess } from "@/lib/admin/access-policy";
import {
  createPrivilegedActionAuditEvidence,
  evaluatePrivilegedPlatformAdminAccess,
  PRIVILEGED_ACTIONS,
  privilegedReasonSchema,
} from "@/lib/admin/privileged-access-policy";

const activeAdmin: PlatformAdminAccess = {
  userId: "9fb5934b-cba1-4aa0-9e87-feb1c0e73842",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};

describe("privileged platform admin policy", () => {
  it.each([
    ["ordinary AAL1", "ordinary", null, "aal1", "NOT_AUTHORIZED"],
    ["ordinary AAL2", "ordinary", null, "aal2", "NOT_AUTHORIZED"],
    ["business owner AAL2", "owner", null, "aal2", "NOT_AUTHORIZED"],
    ["disabled admin AAL2", activeAdmin.userId, null, "aal2", "NOT_AUTHORIZED"],
    ["active admin AAL1", activeAdmin.userId, activeAdmin, "aal1", "MFA_REQUIRED"],
  ] as const)(
    "denies %s",
    (_label, authenticatedUserId, platformAdmin, currentLevel, reason) => {
      expect(
        evaluatePrivilegedPlatformAdminAccess({
          authenticatedUserId,
          platformAdmin,
          currentLevel,
          requiredRoles: ["SUPER_ADMIN"],
        }),
      ).toEqual({ allowed: false, reason });
    },
  );

  it("allows an active super admin only when the verified session is AAL2", () => {
    expect(
      evaluatePrivilegedPlatformAdminAccess({
        authenticatedUserId: activeAdmin.userId,
        platformAdmin: activeAdmin,
        currentLevel: "aal2",
        requiredRoles: ["SUPER_ADMIN"],
      }),
    ).toEqual({ allowed: true });
  });

  it("ignores client-forged role and assurance fields", () => {
    const forgedInput = {
      authenticatedUserId: "ordinary",
      platformAdmin: null,
      currentLevel: "aal1" as const,
      requiredRoles: ["SUPER_ADMIN"] as const,
      role: "SUPER_ADMIN",
      aal: "aal2",
      mfaVerified: true,
    };

    expect(evaluatePrivilegedPlatformAdminAccess(forgedInput)).toEqual({
      allowed: false,
      reason: "NOT_AUTHORIZED",
    });
  });

  it("defines failed-email retry as deferred and independently protected", () => {
    expect(PRIVILEGED_ACTIONS.RETRY_FAILED_EMAIL).toEqual({
      requiredRole: "SUPER_ADMIN",
      requiresAal2: true,
      requiresReason: true,
      targetType: "EMAIL_EVENT",
      implemented: false,
    });
  });

  it("normalizes and bounds privileged reasons", () => {
    expect(privilegedReasonSchema.parse("  Investigate controlled failure  ")).toBe(
      "Investigate controlled failure",
    );
    expect(privilegedReasonSchema.safeParse("   ").success).toBe(false);
    expect(privilegedReasonSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("builds bounded audit evidence without arbitrary secret metadata", () => {
    const evidence = createPrivilegedActionAuditEvidence({
      admin: activeAdmin,
      action: "RETRY_FAILED_EMAIL",
      targetId: "56017a2e-930f-4c11-a48a-1bac6b08c22a",
      reason: "Controlled operator retry",
      result: "ATTEMPTED",
      occurredAt: new Date("2026-08-26T12:00:00.000Z"),
    });

    expect(evidence).toEqual({
      adminUserId: activeAdmin.userId,
      adminRole: "SUPER_ADMIN",
      action: "RETRY_FAILED_EMAIL",
      targetType: "EMAIL_EVENT",
      targetId: "56017a2e-930f-4c11-a48a-1bac6b08c22a",
      reason: "Controlled operator retry",
      occurredAt: "2026-08-26T12:00:00.000Z",
      result: "ATTEMPTED",
    });
    expect(JSON.stringify(evidence)).not.toMatch(
      /totp|secret|verification.?code|access.?token|refresh.?token|cookie/i,
    );
  });

  it("refuses audit evidence for a reason-required action without a reason", () => {
    expect(() =>
      createPrivilegedActionAuditEvidence({
        admin: activeAdmin,
        action: "RETRY_FAILED_EMAIL",
        targetId: "56017a2e-930f-4c11-a48a-1bac6b08c22a",
        result: "DENIED",
      }),
    ).toThrow();
  });
});
