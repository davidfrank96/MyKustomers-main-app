import { expect, test } from "./support/test";

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

test("Terms are public and the modal scrolls, traps focus and restores its trigger at every width", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const response = await request.get("/terms");
  expect(response.status()).toBe(200);
  expect(await response.text()).toMatch(/16(?:<!-- -->)?\. (?:<!-- -->)?Contact/);
  await page.goto("/terms");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://mykustomers.com/terms",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(16);
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");
    const trigger = page.getByRole("link", { name: "Terms of Service", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "My Kustomers Terms of Service" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const body = dialog.getByLabel("Terms of Service text");
    await body.focus();
    await page.keyboard.press("End");
    await expect(dialog.getByRole("heading", { name: "16. Contact" })).toBeInViewport();
    await dialog.getByRole("button", { name: "Close dialog" }).focus();
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await page.getByRole("link", { name: "Terms of Service", exact: true }).click();
  await page.getByRole("link", { name: "Read the full page" }).click();
  await expect(page).toHaveURL(/\/terms$/);
});
