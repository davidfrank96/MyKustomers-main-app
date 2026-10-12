import fs from "node:fs";
import { expect, test } from "@playwright/test";

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
const captures = new Set([320, 390, 430, 768, 1024, 1440]);

test("Terms preserve full content, keyboard disclosure, print and ten-width layout", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const root = `output/playwright/legal/${info.project.name}`;
  fs.mkdirSync(root, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    await page.goto("/terms");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "My KustomersTerms of Service",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://mykustomers.com/terms",
    );
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(16);
    await expect(page.getByRole("button", { expanded: true })).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const cards = page.locator(".legal-section");
    const positions = await cards.evaluateAll((elements) =>
      elements.map((el) => ({
        x: el.getBoundingClientRect().x,
        width: el.getBoundingClientRect().width,
      })),
    );
    expect(new Set(positions.map((p) => `${p.x}/${p.width}`)).size).toBe(1);
    if (captures.has(width)) {
      await page.screenshot({ path: `${root}/terms-${width}-first.png`, fullPage: true });
      await page.screenshot({ path: `${root}/terms-${width}-first-viewport.png` });
    }
    const later = page.getByRole("button", {
      name: "5. Payments and financial information",
    });
    await later.focus();
    await page.keyboard.press("Enter");
    await expect(later).toHaveAttribute("aria-expanded", "true");
    const body = page.locator(`[id="${await later.getAttribute("aria-controls")}"]`);
    await expect(body).toContainText("Businesses must verify actual receipt of money.");
    expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    const triggerBox = (await later.boundingBox())!;
    const bodyBox = (await body.boundingBox())!;
    expect(bodyBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
    expect(
      await body.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(15);
    if (captures.has(width))
      await page.screenshot({ path: `${root}/terms-${width}-later.png`, fullPage: true });
    await page.keyboard.press("Space");
    await expect(later).toHaveAttribute("aria-expanded", "false");
    await expect(later).toBeFocused();
  }
  await page.emulateMedia({ media: "print" });
  for (const body of await page.locator(".legal-body").all())
    await expect(body).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  expect(errors).toEqual([]);
});

test("Terms back link returns to a same-origin entry and has a direct-arrival fallback", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Terms of Service", exact: true }).click();
  await page.getByRole("link", { name: "Read the full page" }).click();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const direct = await context.newPage();
  await direct.goto("/terms");
  await expect(direct.getByRole("link", { name: "Back", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await direct.close();
});
