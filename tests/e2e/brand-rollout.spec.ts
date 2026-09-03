import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./support/test";

const outputDirectory = path.resolve("output/playwright/brand-rollout");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440] as const;

async function expectNoOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth, `${label} overflowed`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function expectRenderedLogo(page: Page) {
  const logo = page.locator("img[data-brand-logo]").first();
  await expect(logo).toBeVisible();
  const dimensions = await logo.evaluate((image: HTMLImageElement) => ({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    width: image.getBoundingClientRect().width,
    height: image.getBoundingClientRect().height,
    objectFit: getComputedStyle(image).objectFit,
  }));
  expect(dimensions.naturalWidth).toBeGreaterThan(0);
  expect(dimensions.naturalHeight).toBeGreaterThan(0);
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
  expect(dimensions.objectFit).toBe("contain");
}

test.describe("MyKustomers.com brand rollout", () => {
  test.beforeAll(() => fs.mkdirSync(outputDirectory, { recursive: true }));

  test("serves exact metadata, manifest, and runtime asset paths", async ({
    page,
    request,
  }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.status()).toBe(200);
    expect(manifestResponse.headers()["content-type"]).toContain(
      "application/manifest+json",
    );
    const manifest = await manifestResponse.json();
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
        expect.objectContaining({ sizes: "192x192", purpose: "monochrome" }),
        expect.objectContaining({ sizes: "512x512", purpose: "monochrome" }),
      ]),
    );

    for (const [asset, contentType] of [
      ["/brand/mykustomers/v1/favicon/favicon.ico", "image/x-icon"],
      ["/brand/mykustomers/v1/pwa/apple-touch-icon.png", "image/png"],
      ["/brand/mykustomers/v1/pwa/mykustomers-icon-192x192.png", "image/png"],
      ["/brand/mykustomers/v1/pwa/mykustomers-icon-512x512.png", "image/png"],
      ["/brand/mykustomers/v1/pwa/mykustomers-icon-maskable-512x512.png", "image/png"],
      ["/brand/mykustomers/v1/pwa/mykustomers-icon-monochrome-512x512.png", "image/png"],
      ["/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png", "image/png"],
      ["/brand/mykustomers/v1/email/mykustomers-email-logo-512w.png", "image/png"],
      ["/brand/mykustomers/v1/logo/mykustomers-logo-horizontal-512w.png", "image/png"],
    ] as const) {
      const response = await request.get(asset);
      expect(response.status(), asset).toBe(200);
      expect(response.headers()["content-type"], asset).toContain(contentType);
    }

    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "From customer request to confirmation, delivery, and feedback — one clear journey.",
      }),
    ).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/brand/mykustomers/v1/pwa/apple-touch-icon.png",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/brand\/mykustomers\/v1\/social\/mykustomers-open-graph-1200x630\.png$/,
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /\/brand\/mykustomers\/v1\/social\/mykustomers-open-graph-1200x630\.png$/,
    );
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).not.toBeNull();
    expect(new URL(canonical!).pathname).toBe("/");
  });

  test("keeps public and auth branding aligned across the hard width gate", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Chromium runs the exact width gate.",
    );
    test.setTimeout(120_000);

    for (const width of widths) {
      const height = width <= 430 ? 932 : width === 768 ? 1024 : 900;
      await page.setViewportSize({ width, height });

      await page.goto("/");
      await expectRenderedLogo(page);
      await expectNoOverflow(page, `homepage at ${width}`);

      await page.goto("/login");
      await expectRenderedLogo(page);
      await expectNoOverflow(page, `login at ${width}`);

      await page.goto("/signup");
      await expectRenderedLogo(page);
      await expectNoOverflow(page, `signup at ${width}`);
    }

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await expectRenderedLogo(page);
    await expectNoOverflow(page, "homepage at 1600");
  });

  test("captures the required public brand review surfaces", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "One browser owns review artifacts.");
    test.setTimeout(90_000);

    for (const [route, width, height, file] of [
      ["/", 390, 844, "homepage-390.png"],
      ["/", 768, 1024, "homepage-768.png"],
      ["/", 1440, 900, "homepage-1440.png"],
      ["/login", 320, 568, "login-320.png"],
      ["/login", 390, 844, "login-390.png"],
      ["/login", 1024, 768, "login-1024.png"],
      ["/signup", 390, 844, "signup-390.png"],
      ["/c/brand-review-invalid-token", 390, 844, "confirmation-390.png"],
      ["/f/brand-review-invalid-token", 390, 844, "feedback-390.png"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      if (route === "/") {
        await expect(
          page.getByRole("heading", {
            name: "From customer request to confirmation, delivery, and feedback — one clear journey.",
          }),
        ).toBeVisible();
      } else if (route === "/login") {
        await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
      } else if (route === "/signup") {
        await expect(
          page.getByRole("heading", { name: "Create your account" }),
        ).toBeVisible();
      } else if (route.startsWith("/c/")) {
        await expect(
          page.getByRole("heading", { name: "Confirmation unavailable" }),
        ).toBeVisible();
      } else if (route.startsWith("/f/")) {
        await expect(
          page.getByRole("heading", { name: "Feedback unavailable" }),
        ).toBeVisible();
        const [brandBox, securityBox] = await Promise.all([
          page.locator(".platform-brand").boundingBox(),
          page.locator(".platform-security").boundingBox(),
        ]);
        expect(brandBox).not.toBeNull();
        expect(securityBox).not.toBeNull();
        expect((brandBox?.x ?? 0) + (brandBox?.width ?? 0)).toBeLessThanOrEqual(
          securityBox?.x ?? 0,
        );
      }
      await expectNoOverflow(page, `${route} screenshot at ${width}`);
      await page.screenshot({ path: path.join(outputDirectory, file), fullPage: true });
    }

    for (const [route, file] of [
      [
        "/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
        "open-graph-runtime.png",
      ],
      [
        "/brand/mykustomers/v1/pwa/mykustomers-icon-maskable-512x512.png",
        "pwa-maskable-runtime.png",
      ],
      ["/brand/mykustomers/v1/favicon/favicon-48x48.png", "favicon-48-runtime.png"],
    ] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(route);
      await page.screenshot({ path: path.join(outputDirectory, file) });
    }
  });
});
