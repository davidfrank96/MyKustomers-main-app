// @vitest-environment node
import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  notificationTopic,
  retryAfterSeconds,
  validWorkerAuthorization,
} from "@/features/notifications/delivery";
import { subscriptionSchema } from "@/features/notifications/contracts";
const id = "11111111-1111-4111-8111-111111111111";
function worker() {
  const events: Record<string, (event: Record<string, unknown>) => void> = {};
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => undefined);
  const focus = vi.fn();
  const postMessage = vi.fn();
  const setAppBadge = vi.fn(async () => undefined);
  const windows = [
    { url: "https://mykustomers.com/bookings/dirty-form", focus, postMessage },
    { url: "https://evil.example/", focus, postMessage: vi.fn() },
  ];
  vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), {
    URL,
    TextEncoder,
    self: {
      addEventListener: (
        name: string,
        handler: (event: Record<string, unknown>) => void,
      ) => {
        events[name] = handler;
      },
      registration: { showNotification },
      navigator: { setAppBadge },
      location: { origin: "https://mykustomers.com" },
      clients: { matchAll: async () => windows, openWindow },
    },
  });
  async function push(data: unknown) {
    let pending: Promise<unknown> | undefined;
    events.push({
      data: { text: () => (typeof data === "string" ? data : JSON.stringify(data)) },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
  }
  async function click(data: unknown) {
    let pending: Promise<unknown> | undefined;
    events.notificationclick({
      notification: { data, close: vi.fn() },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
  }
  return {
    events,
    push,
    click,
    showNotification,
    openWindow,
    focus,
    setAppBadge,
    windows,
  };
}
describe("notification transport and service worker", () => {
  it("uses a constant-length comparison and fails closed without worker credentials", () => {
    expect(validWorkerAuthorization(null, undefined)).toBe(false);
    expect(validWorkerAuthorization("Bearer short", "short")).toBe(false);
    expect(validWorkerAuthorization(`Bearer ${"x".repeat(40)}`, "x".repeat(40))).toBe(
      true,
    );
    expect(validWorkerAuthorization(`Bearer ${"y".repeat(40)}`, "x".repeat(40))).toBe(
      false,
    );
  });
  it("bounds retry instructions and gives duplicates the same valid topic", () => {
    expect(retryAfterSeconds("120")).toBe(120);
    expect(retryAfterSeconds("99999999999")).toBe(86400);
    expect(retryAfterSeconds("invalid")).toBeNull();
    expect(retryAfterSeconds("Thu, 01 Jan 1970 00:01:00 GMT", 0)).toBe(60);
    expect(notificationTopic(id)).toMatch(/^[a-zA-Z0-9_-]{32}$/);
    expect(notificationTopic(id)).toBe(notificationTopic(id));
  });
  it.each([
    "https://localhost/push",
    "http://fcm.googleapis.com/a",
    "https://fcm.googleapis.com.evil.test/a",
    "https://user@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:444/a",
    "https://127.0.0.1/a",
  ])("rejects an unsafe endpoint %s", (endpoint) => {
    expect(
      subscriptionSchema.safeParse({
        endpoint,
        keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
        platform: "web",
      }).success,
    ).toBe(false);
  });
  it.each([
    "CUSTOMER_CONFIRMED",
    "CUSTOMER_FEEDBACK_RECEIVED",
    "BOOKING_OVERDUE",
    "AMENDMENT_RESPONDED",
    "ADD_ON_RESPONDED",
  ])(
    "renders allowlisted copy and ignores supplied customer text for %s",
    async (type) => {
      const sw = worker();
      await sw.push({
        version: 1,
        type,
        notificationId: id,
        unreadCount: 2,
        title: "customer@example.com",
        body: "Private feedback",
        url: "https://evil.example/c/secret",
      });
      const [title, options] = sw.showNotification.mock.calls[0] as unknown as [
        string,
        Record<string, unknown>,
      ];
      expect(JSON.stringify({ title, options })).not.toMatch(
        /customer@example|Private feedback|evil.example|secret/,
      );
      expect(options.tag).toBe(id);
      expect(options.renotify).toBe(false);
      expect(sw.setAppBadge).toHaveBeenCalledWith(2);
      expect(Object.keys(sw.events)).toEqual([
        "install",
        "activate",
        "push",
        "notificationclick",
      ]);
    },
  );
  it.each([
    "not json",
    "x".repeat(2100),
    { version: 2, type: "CUSTOMER_CONFIRMED", notificationId: id, unreadCount: 1 },
    { version: 1, type: "__proto__", notificationId: id, unreadCount: 1 },
  ])("uses a safe visible fallback for invalid input", async (data) => {
    const sw = worker();
    await sw.push(data);
    expect(sw.showNotification).toHaveBeenCalledWith(
      "My Kustomers",
      expect.objectContaining({ data: { notificationId: null } }),
    );
  });
  it("opens an authenticated resolver without replacing a dirty form or trusting an arbitrary URL", async () => {
    const sw = worker();
    await sw.click({ notificationId: id, url: "https://evil.example" });
    expect(sw.openWindow).toHaveBeenCalledWith(
      `https://mykustomers.com/notifications/open/${id}`,
    );
    expect(sw.focus).not.toHaveBeenCalled();
    await sw.click({ notificationId: "../../c/private-token" });
    expect(sw.openWindow).toHaveBeenLastCalledWith(
      "https://mykustomers.com/notifications",
    );
  });
});
