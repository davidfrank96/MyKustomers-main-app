/* Push-only worker. No fetch interception, private response cache or offline shell. */
const COPY = Object.freeze({
  CUSTOMER_CONFIRMED: [
    "Customer confirmed",
    "A booking has been confirmed. Tap to view.",
  ],
  CUSTOMER_FEEDBACK_RECEIVED: [
    "Feedback received",
    "New customer feedback is available. Tap to view.",
  ],
  BOOKING_OVERDUE: ["Booking needs attention", "A booking is overdue. Tap to review it."],
  AMENDMENT_RESPONDED: [
    "Customer confirmed changes",
    "Booking changes have been confirmed. Tap to view.",
  ],
  ADD_ON_RESPONDED: [
    "Customer confirmed an add-on",
    "A booking add-on has been confirmed. Tap to view.",
  ],
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        const text = event.data?.text() ?? "";
        if (new TextEncoder().encode(text).length <= 2048) {
          const data = JSON.parse(text);
          if (
            data?.version === 1 &&
            typeof data.notificationId === "string" &&
            UUID.test(data.notificationId) &&
            Object.hasOwn(COPY, data.type) &&
            Number.isInteger(data.unreadCount) &&
            data.unreadCount >= 0 &&
            data.unreadCount <= 9999
          )
            payload = data;
        }
      } catch {
        /* Always produce a safe user-visible fallback. */
      }
      const [title, body] = payload
        ? COPY[payload.type]
        : ["My Kustomers", "A new update is available. Open the app to view it."];
      await self.registration.showNotification(title, {
        body,
        icon: "/brand/mykustomers/v1/pwa/mykustomers-icon-192x192.png",
        badge: "/brand/mykustomers/v1/pwa/mykustomers-icon-monochrome-192x192.png",
        tag: payload ? payload.notificationId : "myk-update",
        renotify: false,
        data: { notificationId: payload?.notificationId ?? null },
      });
      try {
        if (payload && "setAppBadge" in self.navigator && payload.unreadCount > 0)
          await self.navigator.setAppBadge(payload.unreadCount);
        else if (payload && "clearAppBadge" in self.navigator)
          await self.navigator.clearAppBadge();
      } catch {
        /* App badges are best effort. */
      }
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      windows.forEach((client) => {
        if (new URL(client.url).origin === self.location.origin)
          client.postMessage({ type: "MYK_NOTIFICATION_RECEIVED" });
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const id = event.notification.data?.notificationId;
      const path =
        typeof id === "string" && UUID.test(id)
          ? `/notifications/open/${id}`
          : "/notifications";
      const target = new URL(path, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const sameTarget = windows.find((client) => client.url === target);
      if (sameTarget) return sameTarget.focus();
      // Opening the resolver preserves an existing dirty booking form in another window.
      return self.clients.openWindow(target);
    })(),
  );
});
