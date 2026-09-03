import path from "node:path";
import { expect, test } from "@playwright/test";

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
  [1440, 900],
  [1600, 900],
] as const;
const screenshots = path.resolve("../output/playwright/admin-overview");

for (const [width, height] of viewports) {
  test(`actual component fixtures fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const state of [
      "attention",
      "healthy",
      "loading",
      "long-email",
      "unavailable",
    ]) {
      await page.goto(`/${state}.html`);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const nav = page.getByRole("navigation", { name: "Admin navigation" });
      await expect(nav.getByRole("link")).toHaveCount(7);
      await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      for (const link of await nav.getByRole("link").all()) {
        // Static fixtures have no hydration: test the scroller's reachability here.
        // The actual active/focus scroll behavior is covered by component tests.
        await link.scrollIntoViewIfNeeded();
        await link.focus();
        const box = await link.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await nav.getByRole("link", { name: "Overview" }).scrollIntoViewIfNeeded();
      await nav.getByRole("link", { name: "Overview" }).focus();
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
      const clipped = await page
        .locator("[data-admin-metric], [data-admin-metric] dd")
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map(
              (element) => element.getAttribute("data-admin-metric") ?? element.tagName,
            ),
        );
      expect(clipped).toEqual([]);
      if (state === "healthy")
        expect(await page.locator("[data-attention=true]").count()).toBe(0);
      if (state === "loading")
        await expect(page.getByRole("status")).toHaveText("Loading platform operations");
      if (state === "attention") {
        const cards = page.locator("dl").first().locator(":scope > div");
        const first = await cards.nth(0).boundingBox();
        const second = await cards.nth(1).boundingBox();
        expect(second!.y === first!.y).toBe(width >= 640);
        if (width >= 1280) expect((await cards.nth(3).boundingBox())!.y).toBe(first!.y);
      }
      if (
        [320, 390, 430, 768, 1024, 1280, 1440, 1600].includes(width) &&
        (state === "attention" || [390, 1440].includes(width))
      ) {
        await page.screenshot({
          path: path.join(screenshots, `${state}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
}

test("stress text and reduced-motion loading remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/attention.html");
  await page.locator("time").evaluate((node) => {
    node.textContent =
      "Last refreshed September 30, 2026, 11:59 PM Coordinated Universal Time";
  });
  await page
    .locator("[data-admin-metric] dd span:last-child")
    .first()
    .evaluate((node) => {
      node.textContent =
        "A deliberately long operational description to check natural wrapping at the smallest supported mobile viewport.";
    });
  await page.locator("#system-status-title").evaluate((node) => {
    node.textContent = "System status with an unusually long diagnostic label";
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/loading.html");
  expect(
    await page
      .locator(".animate-pulse")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
});
