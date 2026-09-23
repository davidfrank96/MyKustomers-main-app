import { expect, test } from "@playwright/test";
import { CURRENT_BUSINESS_COOKIE_NAME } from "../../lib/auth/current-business-selection";

const fixtureOrigin = "http://127.0.0.1:55441";

test.beforeEach(async ({ context, request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { platformAdmin: true, memberships: "zero" },
  });
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: fixture.cookie, domain: "127.0.0.1", path: "/" },
    {
      name: CURRENT_BUSINESS_COOKIE_NAME,
      value: "stale-business",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
});

test("admin without vendor membership logs out through the shared flow", async ({
  page,
  context,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const logout = page.getByRole("button", { name: "Log out", exact: true });
    await expect(logout).toBeVisible();
    expect(await logout.evaluate((node) => node.closest("nav"))).toBeNull();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({
    path: `output/playwright/platform-health/${info.project.name}-admin-320.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?message=signed-out/);
  expect(
    (await context.cookies()).some((cookie) =>
      cookie.name.startsWith("sb-127-auth-token"),
    ),
  ).toBe(false);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === CURRENT_BUSINESS_COOKIE_NAME,
    ),
  ).toBe(false);
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json()).sessionRevoked,
  ).toBe(true);
  for (const route of ["/admin", "/admin/businesses", "/admin/emails"]) {
    // Let the login page's deferred RSC prefetches finish before unloading it.
    // WebKit reports cancelled same-origin prefetches as page errors otherwise.
    await page.waitForLoadState("networkidle");
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("heading", { name: "Create business" })).toHaveCount(0);
  }
  await page.waitForLoadState("networkidle");
  await page.goBack();
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("ordinary vendor cannot acquire admin access", async ({ page, request }) => {
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { platformAdmin: false, memberships: "normal" },
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
});
