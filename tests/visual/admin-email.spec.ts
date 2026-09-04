import path from "node:path";
import { expect, test } from "@playwright/test";
import { emailStates } from "../fixtures/admin-email";
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
for (const [width, height] of viewports) {
  test(`Email Operations at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const state of emailStates) {
      await page.goto(`/${state}.html`);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const active = page
        .getByRole("navigation", { name: "Admin navigation" })
        .getByRole("link", { name: "Email Operations" });
      await expect(active).toHaveAttribute("aria-current", "page");
      await active.scrollIntoViewIfNeeded();
      await expect(active).toBeVisible();
      if (state !== "loading") {
        const controls = page.locator(
          '[data-email-filters] input, [data-email-filters] [role="combobox"]',
        );
        await expect(controls).toHaveCount(4);
        const bounds = await controls.evaluateAll((nodes) =>
          nodes.map((node) => {
            const b = node.getBoundingClientRect();
            return { x: b.x, y: b.y, w: b.width, h: b.height };
          }),
        );
        for (const b of bounds) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(width);
          expect(b.h).toBe(44);
        }
        if (width >= 1280) expect(new Set(bounds.map((b) => b.y)).size).toBe(1);
        if (state !== "empty") {
          const region = page.getByRole("region", { name: "Email outbox events" });
          await expect(region.getByRole("listitem")).toHaveCount(20);
          await expect(region.locator("time")).toHaveCount(20);
          expect(await region.locator("[data-email-filters]").count()).toBe(0);
          expect(await region.getByRole("navigation").count()).toBe(0);
          const metrics = await region.evaluate((node) => ({
            height: node.clientHeight,
            content: node.scrollHeight,
            overflow: getComputedStyle(node).overflowY,
          }));
          if (width >= 768) {
            expect(metrics.content).toBeGreaterThan(metrics.height);
            await region.focus();
            await page.keyboard.press("End");
            await expect
              .poll(() =>
                region.evaluate((node) =>
                  Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop),
                ),
              )
              .toBeLessThan(2);
            const last = region.getByRole("link").last();
            await last.focus();
            await expect(last).toBeFocused();
            await page.keyboard.press("Tab");
            expect(
              await region.evaluate((node) => node.contains(document.activeElement)),
            ).toBe(false);
            await region.evaluate((node) => {
              node.scrollTo({ top: 0, behavior: "instant" });
            });
            await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBe(0);
          } else expect(metrics.overflow).toBe("visible");
          await expect(
            page.getByRole("navigation", { name: "Directory pagination" }),
          ).toBeVisible();
        }
        const overflow = await page
          .locator("main section, [data-admin-email-status], [data-admin-directory] a")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => n.scrollWidth > n.clientWidth + 1)
              .map(
                (n) => n.getAttribute("aria-labelledby") ?? n.textContent?.slice(0, 50),
              ),
          );
        expect(overflow).toEqual([]);
      }
      if (
        (state === "healthy" &&
          [320, 390, 430, 768, 1024, 1280, 1440, 1600].includes(width)) ||
        ([390, 1440].includes(width) && state !== "healthy")
      ) {
        await page.evaluate(() => {
          (document.activeElement as HTMLElement)?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: path.resolve(`../output/playwright/admin-email/${state}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
}
test("loading respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/loading.html");
  expect(
    await page
      .locator(".animate-pulse")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
});
