import "server-only";
import {
  getAuthenticatedUser,
  getCurrentBusinessContext,
  type AuthenticatedUser,
} from "@/lib/auth/server";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { isVendorWorkspacePath, resolvePostAuthPath } from "@/lib/auth/post-auth-path";

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
  return resolvePostAuthPath(safeNext, context.currentBusiness !== null);
}
