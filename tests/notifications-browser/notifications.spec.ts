import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const fixtureOrigin = "http://127.0.0.1:55440";
test.beforeEach(async ({ context, request }) => {
  await request.post(`${fixtureOrigin}/fixture/reset`);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: fixture.cookie,
      url: "http://127.0.0.1:3418",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
});
test("notification center, settings and long business names fit the responsive matrix", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Profile & account" })).toBeVisible();
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await expect(bell).toHaveAccessibleName("Notifications, 28 unread");
    await bell.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("link").filter({ hasText: "Customer confirmed" }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if ([320, 390, 1440].includes(width)) {
      await fs.mkdir("test-results/notifications", { recursive: true });
      await page.screenshot({
        path: `test-results/notifications/${testInfo.project.name}-center-${width}.png`,
      });
    }
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await page.locator("#notifications").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: `test-results/notifications/${testInfo.project.name}-settings-${width}.png`,
      });
  }
  expect(errors).toEqual([]);
});
test("pagination, preferences, mark-all-read and safe resolver work through the application APIs", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/notifications");
  await expect(page.getByRole("link").filter({ hasText: "MK-2026-0001" })).toHaveCount(
    25,
  );
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("link").filter({ hasText: "MK-2026-0001" })).toHaveCount(
    28,
  );
  const markResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/notifications/read"),
  );
  await page.getByRole("button", { name: "Mark all read" }).click();
  expect((await markResponse).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page.goto("/settings#notifications");
  await page.getByRole("checkbox", { name: /Customer feedback/ }).uncheck();
  await expect(
    page.getByRole("status").filter({ hasText: "Preferences saved" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: /Customer feedback/ }),
  ).not.toBeChecked();
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const resolved = await context.request.get(
    `/notifications/open/${fixture.notificationId}`,
    { maxRedirects: 0 },
  );
  expect(resolved.status()).toBe(307);
  expect(resolved.headers().location).toBe(
    `/bookings/${fixture.bookingId}#customer-confirmation`,
  );
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "my-customers-current-business",
    )?.value,
  ).toBe(fixture.otherBusinessId);
  const invalid = await context.request.get(
    "/notifications/open/99999999-9999-4999-8999-999999999999",
  );
  expect(invalid.status()).toBe(404);
});
test("denied permission and iOS installation guidance never prompt automatically", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "iPhone",
      configurable: true,
    });
    window.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
      onchange: null,
      media: "",
    });
  });
  await page.goto("/settings#notifications");
  await expect(page.getByText(/tap Share, then Add to Home Screen/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable notifications" })).toHaveCount(0);
});
test("private notification endpoints reject unauthenticated and cross-origin requests", async ({
  page,
  context,
}) => {
  const rejected = await context.request.post("/api/notifications/read", {
    headers: { Origin: "https://evil.example" },
    data: { all: true, before: new Date().toISOString() },
  });
  expect(rejected.status()).toBe(403);
  const worker = await context.request.post("/api/internal/notifications/process", {
    data: {},
  });
  expect(worker.status()).toBe(401);
  const sw = await context.request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(await sw.text()).not.toMatch(/caches\.|respondWith/);
  await context.clearCookies();
  const result = await context.request.get("/api/notifications");
  expect(result.status()).toBe(401);
  expect(result.headers()["cache-control"]).toContain("no-store");
  await page.goto("/notifications/open/40000000-0000-4000-8000-000000000001");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("permission is requested only on Enable, and a device can enable and disable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let permission: NotificationPermission = "default";
    let subscription: {
      endpoint: string;
      options: object;
      toJSON: () => object;
      unsubscribe: () => Promise<boolean>;
    } | null = null;
    let prompts = 0;
    const registration = {
      pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
          subscription = {
            endpoint: "https://fcm.googleapis.com/local-ui-fixture",
            options: {},
            toJSON: () => ({
              endpoint: "https://fcm.googleapis.com/local-ui-fixture",
              keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
            }),
            unsubscribe: async () => {
              subscription = null;
              return true;
            },
          };
          return subscription;
        },
      },
      getNotifications: async () => [],
    };
    Object.defineProperty(navigator, "userAgent", {
      value: "Android",
      configurable: true,
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return permission;
        },
        requestPermission: () => {
          prompts++;
          permission = "granted";
          return Promise.resolve(permission);
        },
      },
    });
    Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
    Object.defineProperty(window, "ServiceWorkerRegistration", {
      configurable: true,
      value: class {
        showNotification() {}
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => registration,
        addEventListener() {},
        removeEventListener() {},
      },
    });
    Object.defineProperty(window, "fixturePermissionPrompts", { get: () => prompts });
  });
  await page.goto("/settings#notifications");
  const enable = page.getByRole("button", { name: "Enable notifications" });
  await expect(enable).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "fixturePermissionPrompts"))).toBe(
    0,
  );
  await page.getByRole("button", { name: "Not now" }).click();
  expect(await page.evaluate(() => Reflect.get(window, "fixturePermissionPrompts"))).toBe(
    0,
  );
  await enable.click();
  await expect(page.getByText("Enabled for this device", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "fixturePermissionPrompts"))).toBe(
    1,
  );
  await page.getByRole("button", { name: "Disable on this device" }).click();
  await expect(enable).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "fixturePermissionPrompts"))).toBe(
    1,
  );
  await enable.click();
  await expect(page.getByText("Enabled for this device", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?message=signed-out/);
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name === "myk-push-device"),
  ).toBe(false);
  expect((await page.request.get("/api/notifications")).status()).toBe(401);
});

test("empty state, keyboard dismissal and a failed save remain usable", async ({
  page,
  request,
}) => {
  await request.post(`${fixtureOrigin}/fixture/empty`);
  await page.goto("/settings");
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await bell.click();
  await expect(page.getByText("You’re all caught up.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bell).toBeFocused();
  await request.post(`${fixtureOrigin}/fixture/preferences-fail`);
  const feedback = page.getByRole("checkbox", { name: /Customer feedback/ });
  await expect(feedback).toBeEnabled();
  await feedback.click();
  await expect(page.locator("#notifications").getByRole("alert")).toContainText(
    "Could not update notifications",
  );
  await expect(feedback).toBeChecked();
  await expect(feedback).toBeEnabled();
});
