export const PWA_RESUME_THRESHOLD_MS = 30_000;
export const PWA_RECONCILE_COOLDOWN_MS = 2_000;
export const PWA_BOOKING_RECONCILE_EVENT = "myk:pwa-booking-reconcile";

export type PwaFreshnessClass = "HIGH" | "NORMAL" | "LOWER";

export function getPwaFreshnessClass(pathname: string): PwaFreshnessClass {
  if (/^\/bookings\/[^/]+$/.test(pathname)) return "HIGH";
  if (
    pathname === "/dashboard" ||
    pathname === "/bookings" ||
    pathname.startsWith("/bookings?") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/")
  ) {
    return "NORMAL";
  }
  return "LOWER";
}

export function shouldReconcileAfterResume(suspendedForMs: number) {
  return suspendedForMs >= PWA_RESUME_THRESHOLD_MS;
}

export function isEligibleOfflineNavigation(
  href: string,
  currentOrigin: string,
  currentHref: string,
) {
  const destination = new URL(href, currentHref);
  if (destination.origin !== currentOrigin) return null;
  if (destination.href === currentHref) return null;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
