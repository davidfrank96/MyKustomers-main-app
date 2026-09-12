"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  defaultPreferences,
  type NotificationPreferences,
} from "@/features/notifications/contracts";
import {
  notificationRequest,
  pushSupport,
  registerNotificationWorker,
  vapidBytes,
} from "@/features/notifications/client";

const categories: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "customer_confirmations",
    label: "Customer confirmations",
    description: "Confirmed bookings, changes and add-ons.",
  },
  {
    key: "customer_feedback",
    label: "Customer feedback",
    description: "When a customer sends private feedback.",
  },
  {
    key: "overdue_bookings",
    label: "Overdue bookings",
    description: "A single alert when a booking becomes overdue.",
  },
];
export function NotificationSettings() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [state, setState] = useState<
    | "loading"
    | "install"
    | "unsupported"
    | "denied"
    | "available"
    | "enabled"
    | "unconfigured"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [prefs, device] = await Promise.all([
        notificationRequest<{ preferences: NotificationPreferences }>("/preferences"),
        notificationRequest<{ enabled: boolean; configured: boolean }>("/subscriptions"),
      ]);
      setPreferences(prefs.preferences);
      setReady(true);
      const support = pushSupport();
      if (support.needsInstall) return setState("install");
      if (!support.supported) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      if (!device.configured || !process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)
        return setState("unconfigured");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setState(
        device.enabled && subscription && Notification.permission === "granted"
          ? "enabled"
          : "available",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load preferences.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);
  async function enable() {
    // Invoke permission directly within the click, before any awaited I/O (iOS).
    const permissionPromise =
      Notification.permission === "granted"
        ? Promise.resolve("granted" as const)
        : Notification.requestPermission();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const permission = await permissionPromise;
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "available");
        return;
      }
      await registerNotificationWorker();
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const publicKey = vapidBytes(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!);
      const currentKey = subscription?.options.applicationServerKey;
      if (
        subscription &&
        currentKey &&
        Array.from(new Uint8Array(currentKey)).join() !== Array.from(publicKey).join()
      ) {
        await notificationRequest("/subscriptions", { method: "DELETE" });
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });
      const json = subscription.toJSON();
      await notificationRequest("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          platform: pushSupport().platform,
        }),
      });
      setState("enabled");
      setNotice("Notifications are enabled for this device.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not enable notifications. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await notificationRequest("/subscriptions", { method: "DELETE" });
      const registration = await navigator.serviceWorker.getRegistration("/");
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      setState("available");
      setNotice("Notifications are off for this device.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not disconnect this device. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function change(key: keyof NotificationPreferences, checked: boolean) {
    const previous = preferences;
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await notificationRequest("/preferences", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setPreferences(next);
      setNotice("Preferences saved.");
    } catch (caught) {
      setPreferences(previous);
      setError(caught instanceof Error ? caught.message : "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card id="notifications" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" aria-hidden="true" />
          Notifications
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Stay updated on confirmations, feedback and overdue bookings. Your in-app
          updates are always available.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {state === "enabled"
              ? "Enabled for this device"
              : "Phone & browser notifications"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {state === "install"
              ? "On iPhone or iPad, open My Kustomers in Safari, tap Share, then Add to Home Screen. Open the installed app to enable notifications (iOS 16.4 or later)."
              : state === "unsupported"
                ? "This browser does not support push notifications. You can still read every update from the notification bell."
                : state === "denied"
                  ? "Notifications are blocked for My Kustomers. You can enable them from your browser or device settings."
                  : state === "enabled"
                    ? "This device can receive updates even when My Kustomers is closed."
                    : state === "unconfigured"
                      ? "Phone notifications are not available yet. Your in-app updates still work."
                      : "Get a brief alert when a booking needs your attention. Customer details stay inside the app."}
          </p>
          {state === "available" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void enable()}>
                {busy ? "Enabling…" : "Enable notifications"}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  setNotice(
                    "No problem. You can enable notifications here whenever you’re ready.",
                  )
                }
              >
                Not now
              </Button>
            </div>
          ) : null}
          {state === "enabled" ? (
            <Button
              variant="secondary"
              className="mt-3"
              disabled={busy}
              onClick={() => void disable()}
            >
              {busy ? "Updating…" : "Disable on this device"}
            </Button>
          ) : null}
        </div>
        <fieldset disabled={busy || !ready} className="min-w-0 divide-y divide-border">
          <legend className="pb-2 text-sm font-medium">
            Push preferences for all your devices
          </legend>
          {categories.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {description}
                </span>
              </span>
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={preferences[key]}
                onChange={(event) => void change(key, event.target.checked)}
              />
            </label>
          ))}
        </fieldset>
        {notice ? (
          <p role="status" className="text-sm leading-6 text-muted-foreground">
            {notice}
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{error}</p>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setError("");
                void refresh();
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
