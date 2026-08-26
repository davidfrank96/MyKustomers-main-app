import "server-only";
import {
  PrivilegedPlatformAdminAuthorizationError,
  requirePlatformAdmin,
  requirePrivilegedPlatformAdmin,
} from "@/lib/admin/server";
import { PLATFORM_ADMIN_ROLES } from "@/lib/admin/access-policy";
import { getAuthenticatedAssuranceLevel } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseAdminMfaSecurityStatus,
  type AdminMfaSecurityStatus,
} from "@/features/admin/security";

export class AdminMfaSecurityUnavailableError extends Error {
  constructor() {
    super("Administrator security information is currently unavailable.");
    this.name = "AdminMfaSecurityUnavailableError";
  }
}

export async function getAdminMfaSecurityStatus(): Promise<AdminMfaSecurityStatus> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const [factorsResult, currentLevel] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    getAuthenticatedAssuranceLevel(),
  ]);

  if (factorsResult.error || !currentLevel) {
    throw new AdminMfaSecurityUnavailableError();
  }

  let privilegedAccessReady = false;
  if (currentLevel === "aal2") {
    try {
      await requirePrivilegedPlatformAdmin(PLATFORM_ADMIN_ROLES);
      privilegedAccessReady = true;
    } catch (error) {
      if (!(error instanceof PrivilegedPlatformAdminAuthorizationError)) throw error;
    }
  }

  const status = parseAdminMfaSecurityStatus({
    currentLevel,
    nextLevel: factorsResult.data.all.some((factor) => factor.status === "verified")
      ? "aal2"
      : "aal1",
    factors: factorsResult.data.all,
    privilegedAccessReady,
  });

  if (!status) throw new AdminMfaSecurityUnavailableError();
  return status;
}
