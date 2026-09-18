import "server-only";
import { getPlatformAdmin } from "@/lib/admin/server";
import { BusinessMembershipLookupError } from "@/lib/auth/business-access";
import type { AuthenticatedUser, BusinessContext } from "@/lib/auth/server";

/** Called only after identity and the membership query have been verified. */
export async function resolveWorkspaceEntry(
  user: AuthenticatedUser,
  context: BusinessContext,
) {
  if (context.currentBusiness) return "/dashboard";

  // An owner may finish the existing required-logo setup, not create a duplicate.
  if (context.pendingBusinesses.some((business) => business.role === "owner")) {
    return "/onboarding";
  }

  if (context.memberships.length > 0) {
    throw new BusinessMembershipLookupError();
  }

  // This is only a destination choice. /admin keeps its role and AAL2 gates.
  if (await getPlatformAdmin(user, true)) return "/admin";
  return "/onboarding";
}
