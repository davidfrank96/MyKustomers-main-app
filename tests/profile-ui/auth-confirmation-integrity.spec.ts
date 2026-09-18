import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fixtureOrigin = "http://127.0.0.1:55441";
const output = "output/playwright/auth-integrity";
const matrix = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  fs.mkdirSync(output, { recursive: true });
});

test("public root and auth pages keep anonymous and stale-cookie users out of onboarding", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: "base64-invalid-session",
      domain: "127.0.0.1",
      path: "/",
    },
    {
      name: "my-customers-current-business",
      value: "deleted-business",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Keep every");
  expect(new URL(page.url()).pathname).toBe("/");
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    for (const [width, height] of matrix) {
      await page.setViewportSize({ width, height });
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await noOverflow(page);
      expect(new URL(page.url()).pathname).toBe(path);
    }
  }
  for (const path of [
    "/onboarding",
    "/bookings/example",
    "/admin/security",
    "/notifications/open/10000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      path === "/admin/security" ? "/admin" : path,
    );
  }
});

test("only authoritative zero memberships render onboarding; lookup failure and stale selection do not", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: fixture.cookie, domain: "127.0.0.1", path: "/" },
    {
      name: "my-customers-current-business",
      value: "deleted-business",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/business");
  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { memberships: "failed" },
  });
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Create business", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create business", exact: true }),
  ).toHaveCount(0);
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { memberships: "zero" },
  });
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Create business", exact: true }),
  ).toBeVisible();
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
  }
});

test("confirmation preserves distinct long title, paragraphs, unbroken text, empty details and currencies", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const title =
    "Chocolate Wedding Cake — three tiers with gold trim and a personalised celebration design for the happy couple";
  const description =
    "Three-tier chocolate cake with gold trim.\n\nDelivery is required by 2:00 PM.\n- Please call the venue coordinator on arrival.\n" +
    "Detailed instructions. ".repeat(72) +
    "\nhttps://example.invalid/" +
    "long-path".repeat(25) +
    "\n" +
    "unbroken".repeat(45);
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { publicBooking: { booking_title: title, booking_description: description } },
  });
  await page.goto(`/c/${fixture.tokenA}`);
  const titleNode = page.locator("dd").filter({ hasText: title });
  const details = page.locator("dd").filter({ hasText: "Three-tier chocolate" });
  await expect(titleNode).toHaveText(title);
  expect(await details.textContent()).toBe(description);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    await expect(titleNode).toBeVisible();
    await expect(details).toBeVisible();
    const titleBox = await titleNode.boundingBox(),
      detailBox = await details.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    expect(detailBox!.y).toBeGreaterThan(titleBox!.y + titleBox!.height);
    expect(
      await details.evaluate((node) => ({
        align: getComputedStyle(node).textAlign,
        whiteSpace: getComputedStyle(node).whiteSpace,
        wrap: getComputedStyle(node).overflowWrap,
      })),
    ).toEqual({ align: "left", whiteSpace: "pre-wrap", wrap: "anywhere" });
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: `${output}/${info.project.name}-confirmation-${width}.png`,
        fullPage: true,
      });
  }
  for (const [currency, symbol] of [
    ["NGN", "₦"],
    ["USD", "$"],
    ["GBP", "£"],
    ["EUR", "€"],
  ]) {
    await request.post(`${fixtureOrigin}/fixture/scenario`, {
      data: { publicBooking: { currency, booking_description: null } },
    });
    await page.reload();
    await expect(page.getByText(`${symbol}459`, { exact: true })).toBeVisible();
    await expect(page.locator("dt", { hasText: "Details" })).toHaveCount(0);
  }
});
