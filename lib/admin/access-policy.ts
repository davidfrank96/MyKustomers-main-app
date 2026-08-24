import type { PlatformAdminRole, PlatformAdminStatus } from "@/types/database";

export const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN"] as const satisfies readonly PlatformAdminRole[];

export type PlatformAdminAccess = {
  userId: string;
  role: PlatformAdminRole;
  status: Extract<PlatformAdminStatus, "ACTIVE">;
};

export function parsePlatformAdminAccess(value: unknown): PlatformAdminAccess | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.user_id !== "string" ||
    candidate.role !== "SUPER_ADMIN" ||
    candidate.status !== "ACTIVE"
  ) {
    return null;
  }

  return {
    userId: candidate.user_id,
    role: candidate.role,
    status: candidate.status,
  };
}

export function hasPlatformAdminRole(
  access: PlatformAdminAccess,
  allowedRoles: readonly PlatformAdminRole[],
) {
  return allowedRoles.includes(access.role);
}
