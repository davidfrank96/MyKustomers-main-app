import path from "node:path";
import { expect, test } from "@playwright/test";
import { securityStates } from "../fixtures/admin-health";
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
const directory = path.resolve("../output/playwright/admin-security");

for (const [width, height] of viewports) {
  test(`security evidence fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const state of securityStates) {
      await page.goto("/" + state + ".html");
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const nav = page.getByRole("navigation", { name: "Admin navigation" });
      await expect(nav.getByRole("link")).toHaveCount(7);
      const active = nav.getByRole("link", { name: "Security & Health" });
      await expect(active).toHaveAttribute("aria-current", "page");
      // Static fixtures do not hydrate; real active/focus handlers have component coverage.
      await active.scrollIntoViewIfNeeded();
      await active.focus();
      const box = (await active.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
      const overflow = await page
        .locator("main section, [data-health-metric], [data-health-state], main dd")
        .evaluateAll((nodes) =>
          nodes
            .filter(
              (node) =>
                getComputedStyle(node).display !== "contents" &&
                node.scrollWidth > node.clientWidth + 1,
            )
            .map(
              (node) =>
                node.getAttribute("aria-labelledby") ?? node.textContent?.slice(0, 60),
            ),
        );
      expect(overflow).toEqual([]);
      for (const service of await page.locator("article").all()) {
        const title = (await service.getByRole("heading").boundingBox())!;
        const badge = (await service.locator("[data-health-state]").boundingBox())!;
        expect(
          title.y + title.height <= badge.y || title.x + title.width + 4 <= badge.x,
        ).toBe(true);
      }
      if (state !== "loading") {
        const refresh = page.getByRole("button", {
          name: state === "refreshing" ? "Refreshing..." : "Refresh status",
        });
        await expect(refresh).toBeVisible();
        if (state === "refreshing") await expect(refresh).toBeDisabled();
        const attention = (await page.locator("#health-attention-title").boundingBox())!;
        const email = (await page.locator("#email-health-title").boundingBox())!;
        expect(email.x > attention.x + 100).toBe(width >= 1280);
      } else
        await expect(page.getByRole("status")).toHaveText("Loading security and health");
      if (state === "activity" || state === "stress") {
        const region = page.getByRole("region", { name: "Recent security activity" });
        await expect(region.getByRole("listitem")).toHaveCount(12);
        const geometry = await region.evaluate((node) => ({
          height: node.clientHeight,
          content: node.scrollHeight,
          overflow: getComputedStyle(node).overflowY,
        }));
        if (width >= 768) {
          expect(geometry.height).toBeLessThanOrEqual(400);
          expect(geometry.content).toBeGreaterThan(geometry.height);
          await region.focus();
          await page.keyboard.press("End");
          await expect
            .poll(() => region.evaluate((node) => node.scrollTop))
            .toBeGreaterThan(0);
          await region.evaluate((node) => {
            node.scrollTop = 0;
          });
        } else {
          expect(geometry.overflow).toBe("visible");
          expect(geometry.content).toBeLessThanOrEqual(geometry.height + 1);
        }
      }
      if (
        [320, 390, 430, 768, 1024, 1280, 1440, 1600].includes(width) &&
        (state === "attention" || [390, 1440].includes(width))
      ) {
        await page.evaluate(() => {
          (document.activeElement as HTMLElement).blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: path.join(directory, state + "-" + width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
}
test("loading and pending refresh respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const state of ["loading", "refreshing"]) {
    await page.goto("/" + state + ".html");
    const animation = page
      .locator(state === "loading" ? ".animate-pulse" : ".animate-spin")
      .first();
    expect(await animation.evaluate((node) => getComputedStyle(node).animationName)).toBe(
      "none",
    );
  }
});
