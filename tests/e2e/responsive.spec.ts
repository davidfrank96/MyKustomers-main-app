import { expect, test, type Page } from "@playwright/test";

const requiredWidths = [320, 360, 375, 390, 430, 768, 834, 1024, 1280, 1440];
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/c/invalid",
  "/f/invalid",
];

async function expectNoPageOverflow(page: Page, route: string, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `${route} overflowed at ${width}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("public and authentication routes avoid horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One project covers the explicit viewport matrix.");

  for (const width of requiredWidths) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });

    for (const route of publicRoutes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      await expectNoPageOverflow(page, route, width);
    }
  }
});
