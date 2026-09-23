import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

const fixtureOrigin = "http://127.0.0.1:55440";
const baseline = process.env.GOLDEN_BASELINE === "1";
const stage =
  process.env.NOTIFICATIONS_PRODUCTION_BUILD === "1"
    ? "production"
    : baseline
      ? "before"
      : "after";
const viewports = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [360, 640],
  [390, 600],
  [430, 650],
  [1024, 600],
  [1366, 650],
  [844, 390],
];

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function anchored(page: Page) {
  const nav = page.getByRole("navigation", { name: "Mobile vendor navigation" });
  if ((page.viewportSize()?.width ?? 0) >= 1024) return expect(nav).toBeHidden();
  await expect(nav).toBeVisible();
  for (const y of [0, 400, 10000, 200, 0]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const box = document
            .querySelector('[aria-label="Mobile vendor navigation"]')!
            .getBoundingClientRect();
          return Math.abs(window.innerHeight - box.bottom);
        }),
      )
      .toBeLessThanOrEqual(2);
  }
  expect(
    await page.locator("body").evaluate((el) => ({
      overflow: el.style.overflow,
      position: el.style.position,
      pointerEvents: el.style.pointerEvents,
    })),
  ).toEqual({ overflow: "", position: "", pointerEvents: "" });
}

test.beforeEach(async ({ context, request, baseURL }) => {
  await request.post(`${fixtureOrigin}/fixture/reset`);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: fixture.cookie,
      url: baseURL!,
      sameSite: "Lax",
    },
  ]);
});

test("golden shell: ordinary and notification navigation stay anchored through scrolling", async ({
  page,
  request,
}, info) => {
  test.setTimeout(180000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const output = `output/playwright/golden-stability/${stage}/${info.project.name}`;
  await fs.mkdir(output, { recursive: true });
  const errors: string[] = [];
  const failedRequests: { url: string; error: string | undefined }[] = [];
  const measurements = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Profile & account" })).toBeVisible();
  // Hydration and Next's development stack-frame requests can outlive visible
  // content. Require actual hydration, then let requests settle before screenshots
  // or forced document navigation;
  // Linux WebKit surfaces cancelled requests as uncaught page errors.
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await anchored(page);
  await page.screenshot({ path: `${output}/normal-nav.png` });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Customer confirmed", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/notification-panel.png` });
  await dialog
    .getByRole("link")
    .filter({ hasText: "Customer confirmed" })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/bookings/${fixture.bookingId}#customer-confirmation`),
  );
  await expect(
    page.getByRole("heading", { name: "Golden stability booking" }),
  ).toBeVisible();
  await anchored(page);
  await page.screenshot({ path: `${output}/notification-destination.png` });
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Profile & account" })).toBeVisible();
  // Back may restore a live modal in BFCache. Closing it must release its lock.
  if (await page.getByRole("dialog").isVisible())
    await page.getByRole("button", { name: "Close dialog" }).click();
  await anchored(page);
  const routes = [
    "/dashboard",
    "/bookings",
    `/bookings/${fixture.bookingId}`,
    "/customers",
    `/customers/${fixture.customerId}`,
    "/business",
    "/notifications",
    "/bookings/new",
    "/business/edit",
    "/settings",
  ];
  for (const route of routes) {
    await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.waitForLoadState("networkidle");
    const start = Date.now();
    const response = await page.goto(route);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.waitForLoadState("networkidle");
    expect(response?.status()).toBe(200);
    const timing = await page.evaluate(() => {
      const n = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const scripts = performance
        .getEntriesByType("resource")
        .filter(
          (r) => (r as PerformanceResourceTiming).initiatorType === "script",
        ) as PerformanceResourceTiming[];
      return {
        responseMs: n.responseStart - n.requestStart,
        clientJsBytes: scripts.reduce((sum, r) => sum + r.decodedBodySize, 0),
      };
    });
    measurements.push({ route, elapsedMs: Date.now() - start, ...timing });
    for (const [width, height] of baseline
      ? [
          [390, 844],
          [1440, 900],
        ]
      : viewports) {
      await page.setViewportSize({ width, height });
      await contained(page);
      await anchored(page);
    }
    if (["/business", `/bookings/${fixture.bookingId}`].includes(route)) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: `${output}/${route === "/business" ? "profile" : "booking-details"}.png`,
      });
    }
  }
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await fs.writeFile(
    `${output}/baseline.json`,
    JSON.stringify({ measurements, errors, failedRequests }, null, 2),
  );
  expect(errors).toEqual([]);
});

test("golden confirmation: Done closes a script-opened tab or gives a focused terminal state", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const output = `output/playwright/golden-stability/${stage}/${info.project.name}`;
  await fs.mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (baseline)
    await page.addInitScript(() => {
      const events: unknown[] = [];
      Reflect.set(window, "goldenInputEvents", events);
      for (const type of ["input", "change", "click"])
        document.addEventListener(
          type,
          (event) => {
            const target = event.target as HTMLInputElement;
            if (target.id === "contact_email" || target.tagName === "BUTTON")
              events.push({
                type,
                target: target.id || target.textContent,
                value: target.value,
                reactProps: Object.keys(target).some((key) =>
                  key.startsWith("__reactProps"),
                ),
                at: performance.now(),
              });
          },
          true,
        );
    });
  await page.goto(`/c/${fixture.confirmationToken}`);
  await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
  await page.getByLabel("Email address").fill("Customer@EXAMPLE.INVALID");
  await page.getByRole("button", { name: "Review and confirm" }).click();
  if (baseline)
    await fs.writeFile(
      `${output}/input-events.json`,
      JSON.stringify(
        await page.evaluate(() => Reflect.get(window, "goldenInputEvents")),
        null,
        2,
      ),
    );
  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await page.screenshot({ path: `${output}/confirmation-success.png` });
  // Simulate a browser that refuses close, without relying on Playwright's tab ownership.
  await page.evaluate(() => {
    window.close = () => undefined;
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  if (baseline) {
    await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  } else {
    const heading = page.getByRole("heading", { name: "You're all set" });
    await expect(heading).toBeFocused();
    await expect(page.getByRole("button", { name: "Done", exact: true })).toHaveCount(0);
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await contained(page);
      await expect(heading).toBeVisible();
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    }
    await page.screenshot({ path: `${output}/confirmation-terminal.png` });
  }
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json())
      .confirmationCalls,
  ).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Booking already confirmed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm booking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
});

test("golden notification panel: bounded history, first read timing and one count per load", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Notifications, 28 unread" }),
  ).toBeVisible();
  const countRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("countOnly")) countRequests.push(r.url());
  });
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const dialog = page.getByRole("dialog");
    const history = dialog.getByRole("region", { name: "Notification history" });
    await expect(history.getByRole("link").first()).toBeVisible();
    await contained(page);
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    expect(await history.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await history.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(history.getByRole("button", { name: "Load more" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await anchored(page);
  }
  expect(countRequests).toHaveLength(0);
  await request.post(`${fixtureOrigin}/fixture/retention`);
  await page.goto("/notifications");
  await expect(
    page.getByRole("region", { name: "Notification history" }).getByRole("link"),
  ).toHaveCount(3);
  const before = (await (await request.get(`${fixtureOrigin}/fixture/state`)).json())
    .notifications;
  const read = before.find((n: { read_at: string | null }) => n.read_at);
  await page.context().request.get(`/notifications/open/${read.id}`, { maxRedirects: 0 });
  const marked = page.waitForResponse((r) => r.url().endsWith("/api/notifications/read"));
  await page.getByRole("button", { name: "Mark all read" }).click();
  expect((await marked).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  const after = (await (await request.get(`${fixtureOrigin}/fixture/state`)).json())
    .notifications;
  expect(after.find((n: { id: string }) => n.id === read.id).read_at).toBe(read.read_at);
  expect(
    after.slice(0, 2).every((n: { read_at: string | null }) => Boolean(n.read_at)),
  ).toBe(true);
});

test("golden PWA: existing worker, standalone resize, resume and cold resolver keep one shell", async ({
  page,
  request,
  context,
}) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query === "(display-mode: standalone)"
        ? { ...matchMedia(query), matches: true }
        : matchMedia(query);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /^Notifications/ })).toBeVisible();
  const existing = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return {
      scope: registration.scope,
      script: registration.active?.scriptURL,
      caches: await caches.keys(),
    };
  });
  expect(existing.script).toContain("/sw.js");
  expect(existing.caches).toEqual([]);
  await page.reload();
  for (const [width, height] of [
    [390, 600],
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await anchored(page);
  }
  const background = await context.newPage();
  await background.bringToFront();
  await page.bringToFront();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await anchored(page);
  const cold = await context.newPage();
  await cold.setViewportSize({ width: 390, height: 844 });
  await cold.goto(`/notifications/open/${fixture.notificationId}`);
  await expect(
    cold.getByRole("heading", { name: "Golden stability booking" }),
  ).toBeVisible();
  await expect(
    cold.getByRole("navigation", { name: "Mobile vendor navigation" }),
  ).toHaveCount(1);
  await anchored(cold);
  expect(
    (await context.cookies()).find((c) => c.name === "my-customers-current-business")
      ?.value,
  ).toBe(fixture.otherBusinessId);
  await background.close();
  await cold.close();
});

test("golden confirmation: a script-opened success window really closes", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await page.goto("/");
  const opened = page.waitForEvent("popup");
  await page.evaluate((token: string) => {
    window.open(`/c/${token}`, "_blank");
  }, fixture.confirmationToken);
  const popup = await opened;
  await popup.getByLabel("Email address").fill("Customer@example.invalid");
  await popup.getByRole("button", { name: "Review and confirm" }).click();
  await popup.getByRole("button", { name: "Confirm booking" }).click();
  const closed = popup.waitForEvent("close");
  await popup.getByRole("button", { name: "Done" }).click();
  await closed;
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json())
      .confirmationCalls,
  ).toBe(1);
});

test("notification Preferences navigation releases its dialog and scroll lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/business");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Preferences" }).click();
  await expect(page).toHaveURL(/\/settings#notifications/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await anchored(page);
});
