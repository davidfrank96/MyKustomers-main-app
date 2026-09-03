import { expect, test } from "./support/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "MyKustomers.com home" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "From customer request to confirmation, delivery, and feedback — one clear journey.",
    }),
  ).toBeVisible();
  await expect(page.getByText("My Customers", { exact: true })).toHaveCount(0);
});

test("dashboard shell loads on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("auth screens render on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
