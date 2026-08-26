import { z } from "zod";
import type { PlatformAdminAccess } from "@/lib/admin/access-policy";
import type { AuthenticatorAssuranceLevel } from "@/lib/auth/server";
import type { PlatformAdminRole } from "@/types/database";

export const PRIVILEGED_REASON_MAX_LENGTH = 500;

export const privilegedReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(
    PRIVILEGED_REASON_MAX_LENGTH,
    `Reason must be ${PRIVILEGED_REASON_MAX_LENGTH} characters or fewer.`,
  );

export const PRIVILEGED_ACTIONS = {
  RETRY_FAILED_EMAIL: {
    requiredRole: "SUPER_ADMIN",
    requiresAal2: true,
    requiresReason: true,
    targetType: "EMAIL_EVENT",
    implemented: true,
  },
} as const;

export type PrivilegedActionType = keyof typeof PRIVILEGED_ACTIONS;
export type PrivilegedTargetType =
  (typeof PRIVILEGED_ACTIONS)[PrivilegedActionType]["targetType"];

export type PrivilegedAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "UNAUTHENTICATED" | "NOT_AUTHORIZED" | "MFA_REQUIRED";
    };

export function evaluatePrivilegedPlatformAdminAccess({
  authenticatedUserId,
  platformAdmin,
  currentLevel,
  requiredRoles,
}: {
  authenticatedUserId: string | null;
  platformAdmin: PlatformAdminAccess | null;
  currentLevel: AuthenticatorAssuranceLevel | null;
  requiredRoles: readonly PlatformAdminRole[];
}): PrivilegedAccessDecision {
  if (!authenticatedUserId) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  if (
    !platformAdmin ||
    platformAdmin.userId !== authenticatedUserId ||
    platformAdmin.status !== "ACTIVE" ||
    !requiredRoles.includes(platformAdmin.role)
  ) {
    return { allowed: false, reason: "NOT_AUTHORIZED" };
  }

  if (currentLevel !== "aal2") {
    return { allowed: false, reason: "MFA_REQUIRED" };
  }

  return { allowed: true };
}

export type PrivilegedAuditResult = "ATTEMPTED" | "SUCCEEDED" | "FAILED" | "DENIED";

export type PrivilegedActionAuditEvidence = {
  adminUserId: string;
  adminRole: PlatformAdminRole;
  action: PrivilegedActionType;
  targetType: PrivilegedTargetType;
  targetId: string;
  reason: string | null;
  occurredAt: string;
  result: PrivilegedAuditResult;
};

export function createPrivilegedActionAuditEvidence({
  admin,
  action,
  targetId,
  reason,
  result,
  occurredAt = new Date(),
}: {
  admin: PlatformAdminAccess;
  action: PrivilegedActionType;
  targetId: string;
  reason?: string | null;
  result: PrivilegedAuditResult;
  occurredAt?: Date;
}): PrivilegedActionAuditEvidence {
  const policy = PRIVILEGED_ACTIONS[action];
  const normalizedReason = policy.requiresReason
    ? privilegedReasonSchema.parse(reason ?? "")
    : reason
      ? privilegedReasonSchema.parse(reason)
      : null;

  return {
    adminUserId: admin.userId,
    adminRole: admin.role,
    action,
    targetType: policy.targetType,
    targetId,
    reason: normalizedReason,
    occurredAt: occurredAt.toISOString(),
    result,
  };
}
