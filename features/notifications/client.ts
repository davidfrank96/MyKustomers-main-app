"use client";
import { NOTIFICATIONS_CHANGED } from "@/features/notifications/contracts";
export async function notificationRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Please sign in again."
        : response.status === 409
          ? "This browser is connected to another account. Log out of that account on this browser, then try again."
          : "Could not update notifications. Please try again.",
    );
  return response.json() as Promise<T>;
}
export function notificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
export async function updateAppBadge(count: number) {
  const badgeNavigator = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await badgeNavigator.setAppBadge?.(count);
    else await badgeNavigator.clearAppBadge?.();
  } catch {
    /* Badging is optional on supported devices. */
  }
  if (count === 0 && "serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker
      .getRegistration("/")
      .catch(() => undefined);
    const visible = await registration?.getNotifications().catch(() => []);
    visible?.forEach((notification) => notification.close());
  }
}
export function pushSupport() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return {
    needsInstall: ios && !standalone,
    supported:
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      "ServiceWorkerRegistration" in window &&
      "showNotification" in ServiceWorkerRegistration.prototype,
    platform: ios
      ? ("ios" as const)
      : /Android/i.test(navigator.userAgent)
        ? ("android" as const)
        : ("desktop" as const),
  };
}
export async function registerNotificationWorker() {
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}
export function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(
    key
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(key.length / 4) * 4, "="),
  );
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
