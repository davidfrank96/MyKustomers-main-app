import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const homepageViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
] as const;

const screenshotDirectory = path.resolve("test-results/public-homepage");

async function expectNoPageOverflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `public homepage overflowed at ${width}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function hideDevelopmentChrome(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.parentNode?.removeChild(element);
    });
  });
}

test.describe("public homepage", () => {
  test("uses approved branding, landmarks, routes, and section navigation", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(
      "My Kustomers — Customers, Bookings, Confirmations & Insights for Small Businesses",
    );
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: "My Kustomers home" })).toBeVisible();
    await expect(page.getByText("My Customers", { exact: true })).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    for (const signupLink of await page
      .getByRole("link", { name: /Create account|Get started/ })
      .all()) {
      await expect(signupLink).toHaveAttribute("href", "/signup");
    }

    const publicNavigation = page.getByRole("navigation", {
      name: "Public homepage sections",
    });
    await expect(
      publicNavigation.getByRole("link", { name: "Features" }),
    ).toHaveAttribute("href", "#features");
    await expect(
      publicNavigation.getByRole("link", { name: "How it works" }),
    ).toHaveAttribute("href", "#how-it-works");
    await expect(
      publicNavigation.getByRole("link", { name: "For businesses" }),
    ).toHaveAttribute("href", "#for-businesses");
    await expect(publicNavigation.getByText("Pricing", { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.getByRole("heading", { name: "How it works" })).toBeInViewport();

    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    await page.goto("/");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });

  test("matches the required responsive and screenshot gate", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "One browser covers the explicit public homepage viewport matrix.",
    );

    fs.mkdirSync(screenshotDirectory, { recursive: true });

    for (const viewport of homepageViewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("link", { name: "My Kustomers home" })).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Manage customers. Book, deliver, follow up. All in one place.",
        }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Illustrative My Kustomers workspace preview"),
      ).toBeVisible();
      await expect(page.locator("#how-it-works-heading")).toBeAttached();
      await expect(page.locator("#for-businesses-heading")).toBeAttached();
      if (viewport.width >= 768) {
        await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Perfect for businesses that..." }),
        ).toBeVisible();
      }
      await expectNoPageOverflow(page, viewport.width);
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, `homepage-${viewport.width}.png`),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await hideDevelopmentChrome(page);
    await page.screenshot({
      path: path.join(screenshotDirectory, "homepage-hero-mobile-390.png"),
    });
    await page.getByLabel("Illustrative My Kustomers workspace preview").screenshot({
      path: path.join(screenshotDirectory, "homepage-product-preview-mobile-390.png"),
    });

    const mobileFinalCta = page.getByRole("heading", {
      name: "Run your business. We'll handle the rest.",
    });
    await mobileFinalCta.scrollIntoViewIfNeeded();
    await mobileFinalCta.locator("xpath=ancestor::section[1]").screenshot({
      path: path.join(screenshotDirectory, "homepage-final-cta-mobile-390.png"),
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await hideDevelopmentChrome(page);
    await page.screenshot({
      path: path.join(screenshotDirectory, "homepage-hero-desktop-1440.png"),
    });

    for (const [name, selector] of [
      ["features", "#features"],
      ["how-it-works", "#how-it-works"],
      ["for-businesses", "#for-businesses"],
    ] as const) {
      await page.locator(selector).screenshot({
        path: path.join(screenshotDirectory, `homepage-section-${name}-1440.png`),
      });
    }

    const finalCta = page.getByRole("heading", {
      name: "Run your business. We'll handle the rest.",
    });
    await finalCta.scrollIntoViewIfNeeded();
    await finalCta.locator("xpath=ancestor::section[1]").screenshot({
      path: path.join(screenshotDirectory, "homepage-final-cta-1440.png"),
    });
  });
});
