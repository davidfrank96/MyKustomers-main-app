import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./support/test";

const homepageViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
] as const;

const screenshotDirectory = path.resolve("test-results/public-homepage");
const headline = "Keep every customer in the loop.";
const title = "Keep Customers Informed from Order to Delivery | MyKustomers";
const description =
  "MyKustomers helps businesses confirm orders, keep customers updated, manage changes, deliver professionally, and collect feedback — all in one clear customer journey.";

async function expectNoPageOverflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `public homepage overflowed at ${width}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function hideDevelopmentChrome(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
}

test.describe("public homepage", () => {
  test("keeps short-screen hero actions reachable and footer links comfortably tappable", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 360, height: 640 },
      { width: 390, height: 600 },
      { width: 430, height: 650 },
      { width: 1024, height: 600 },
      { width: 1366, height: 650 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: headline, level: 1 })).toBeVisible();
      const hero = page.locator('section[aria-labelledby="homepage-heading"]');
      await expect(hero.getByRole("link", { name: "Get started" })).toBeInViewport({
        ratio: 1,
      });
      await expect(hero.getByRole("link", { name: "See how it works" })).toBeInViewport({
        ratio: 1,
      });
      if (viewport.width < 375) {
        const replay = hero.getByRole("button", { name: "Replay demo" });
        const delivery = hero
          .getByRole("list", { name: "Illustrative customer updates" })
          .getByRole("listitem")
          .filter({ hasText: "Out for delivery" });
        await expect(delivery).toBeVisible();
        const controlBounds = await replay.boundingBox();
        const cardBounds = await delivery.boundingBox();
        expect(controlBounds).not.toBeNull();
        expect(cardBounds).not.toBeNull();
        expect(cardBounds!.y).toBeGreaterThanOrEqual(
          controlBounds!.y + controlBounds!.height,
        );
      }
      for (const link of await page
        .getByRole("navigation", { name: "Footer navigation" })
        .getByRole("link")
        .all()) {
        await link.scrollIntoViewIfNeeded();
        const bounds = await link.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toHaveCSS("outline-style", "solid");
      }
      await expectNoPageOverflow(page, viewport.width);
    }
  });

  test("uses approved branding, metadata, landmarks and existing CTA destinations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page).toHaveTitle(title);
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) {
      await expect(page.locator(selector)).toHaveAttribute("content", description);
    }
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      title,
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      "content",
      title,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://mykustomers.com",
    );
    const structuredData = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    );
    expect(structuredData["@graph"].map((entry: { name: string }) => entry.name)).toEqual(
      ["MyKustomers", "MyKustomers", "MyKustomers"],
    );
    expect(structuredData["@graph"][2].description).toBe(description);

    for (const landmark of ["banner", "main", "contentinfo"] as const)
      await expect(page.getByRole(landmark)).toBeVisible();
    await expect(page.getByRole("link", { name: "MyKustomers.com home" })).toBeVisible();
    await expect(page.getByText("My Customers", { exact: true })).toHaveCount(0);
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    for (const link of await page.getByRole("link", { name: "Get started" }).all())
      await expect(link).toHaveAttribute("href", "/signup");
    const navigation = page.getByRole("navigation", { name: "Public homepage sections" });
    for (const [name, href] of [
      ["Features", "#features"],
      ["How it works", "#how-it-works"],
      ["For businesses", "#for-businesses"],
    ]) {
      await expect(navigation.getByRole("link", { name })).toHaveAttribute("href", href);
      await expect(page.locator(href)).toHaveCount(1);
    }
    await expect(navigation.getByText("Pricing", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(
      page.getByRole("heading", { name: "One clear journey" }),
    ).toBeInViewport();
    await header.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page).toHaveURL(/#features$/);
    await expect(
      page.getByRole("region", { name: "Illustrative MyKustomers workspace preview" }),
    ).toBeInViewport();
    await page
      .locator("main > section")
      .first()
      .getByRole("link", { name: "Get started" })
      .click();
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
      "One browser covers the permanent public homepage viewport matrix.",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    for (const viewport of homepageViewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: headline, level: 1 })).toBeVisible();
      await expect(
        page.getByText(
          "For businesses that manage customer work from order to delivery",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText(
          "From confirmation to delivery and feedback, MyKustomers helps businesses give customers a clear, professional experience.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Confirm what was agreed. Keep customers updated. Manage changes. Deliver professionally.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.locator("#how-it-works li")).toHaveText([
        "Request",
        "Confirmation",
        "Updates",
        "Delivery",
        "Feedback",
      ]);
      const demo = page.getByRole("region", {
        name: "Illustrative MyKustomers workspace preview",
      });
      await expect(demo).toBeVisible();
      await expect(demo.getByTestId("demo-booking-status")).toHaveText("Confirmed");
      await expect(demo.getByTestId("demo-email-status")).toHaveText("Sent");
      await expect(demo.getByTestId("demo-work-status")).toHaveText("In progress");
      await expect(demo.getByTestId("demo-feedback-status")).toHaveText("5 ★");
      await expect(demo.getByRole("button", { name: "Replay demo" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Turn updates into loyal customers." }),
      ).toBeVisible();
      await expectNoPageOverflow(page, viewport.width);
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, `homepage-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });
});
