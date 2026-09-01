import { getSafeRedirectPath } from "@/lib/security/redirects";

const vendorWorkspaceRoots = [
  "/dashboard",
  "/bookings",
  "/customers",
  "/insights",
  "/business",
  "/settings",
] as const;

export function isVendorWorkspacePath(value: string) {
  const pathname = new URL(value, "https://mykustomers.invalid").pathname;

  return vendorWorkspaceRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function resolvePostAuthPath(
  next: FormDataEntryValue | string | null | undefined,
  hasCurrentBusiness: boolean,
) {
  const safeNext = getSafeRedirectPath(next);

  if (!hasCurrentBusiness && isVendorWorkspacePath(safeNext)) {
    return "/onboarding";
  }

  return safeNext;
}
