import "server-only";
import {
  getAuthenticatedUser,
  getCurrentBusinessContext,
  type AuthenticatedUser,
} from "@/lib/auth/server";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { isVendorWorkspacePath, resolvePostAuthPath } from "@/lib/auth/post-auth-path";
import { resolveWorkspaceEntry } from "@/lib/auth/workspace-entry";
import { BusinessMembershipLookupError } from "@/lib/auth/business-access";

export async function resolvePostAuthDestination(
  next: FormDataEntryValue | string | null | undefined,
  authenticatedUser?: AuthenticatedUser,
) {
  const safeNext = getSafeRedirectPath(next);

  if (!isVendorWorkspacePath(safeNext)) {
    return safeNext;
  }

  const user = authenticatedUser ?? (await getAuthenticatedUser());
  if (!user) {
    return "/login";
  }

  const context = await getCurrentBusinessContext(user);
  if (!context.currentBusiness) return resolveWorkspaceEntry(user, context);
  return resolvePostAuthPath(safeNext, context.currentBusiness !== null);
}

/** Session creation succeeded; a failed membership read must not replay login/OAuth. */
export async function resolvePostAuthDestinationWithRecovery(
  next: FormDataEntryValue | string | null | undefined,
  authenticatedUser: AuthenticatedUser,
) {
  try {
    return await resolvePostAuthDestination(next, authenticatedUser);
  } catch (error) {
    if (!(error instanceof BusinessMembershipLookupError)) throw error;
    return `/login?next=${encodeURIComponent(getSafeRedirectPath(next))}`;
  }
}
