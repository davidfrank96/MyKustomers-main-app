import fs from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";

const fixtureOrigin = "http://127.0.0.1:55441";
const artifactRoot = "output/playwright/my-profile-phase-2";
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
] as const;
const screenshotWidths = new Set([320, 360, 390, 430, 768, 1024, 1280, 1440]);
const captureStyle = "nextjs-portal { visibility: hidden !important; }";

async function ready(page: Page) {
  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function fullPageCapture(page: Page, path: string) {
  const viewport = page.viewportSize()!;
  // Expand capture height to put fixed mobile navigation at the full-page edge.
  // The requested device viewport is verified separately and restored immediately.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({
    width: viewport.width,
    height: Math.max(height, viewport.height),
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path,
    fullPage: true,
    animations: "disabled",
    style: captureStyle,
  });
  await page.setViewportSize(viewport);
}

test.beforeEach(async ({ context, request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: fixture.cookie, domain: "127.0.0.1", path: "/" },
  ]);
  fs.mkdirSync(artifactRoot, { recursive: true });
});

test("the Profile hub follows the ten-width alignment and native-scroll gate", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const measurements = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pendingPrefetches = new Set<Request>();
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("_rsc")) pendingPrefetches.add(request);
  });
  const finished = (request: Request) => {
    pendingPrefetches.delete(request);
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  const settlePrefetches = () => expect.poll(() => pendingPrefetches.size).toBe(0);
  await page.goto("/business");
  await ready(page);
  for (const [width, height] of matrix) {
    await settlePrefetches();
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await ready(page);
    await noOverflow(page);
    await expect(page.locator("main li")).toHaveCount(9);
    await expect(
      page.getByRole("heading", { level: 2, name: "Harbour Studio", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-profile-summary] time")).toHaveText("Jan 2026");
    await expect(page.locator("[data-profile-summary] img")).toBeVisible();
    await expect(page.locator("[data-profile-summary] img")).toHaveJSProperty(
      "complete",
      true,
    );
    expect(
      await page
        .locator("[data-profile-summary] img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);

    const geometry = await page.evaluate(() => {
      const rect = (e: Element) => {
        const r = e.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      const summary = document.querySelector("[data-profile-summary]")!;
      const name = summary.querySelector("h2")!;
      const badge = [...summary.querySelectorAll("span")].find(
        (e) => e.textContent?.trim() === "Active",
      )!;
      const logo = summary.querySelector("img")!;
      return {
        header: rect(document.querySelector("header")!),
        logo: rect(logo),
        name: rect(name),
        badge: rect(badge),
        edit: rect(summary.querySelector("a,button")!),
        rows: [...document.querySelectorAll("main li")].map((row) => ({
          row: rect(row),
          icon: rect((row.querySelector(":scope > a") ?? row).firstElementChild!),
          chevron: rect((row.querySelector(":scope > a") ?? row).lastElementChild!),
          font: getComputedStyle(row.querySelector("h3")!).fontSize,
        })),
      };
    });
    expect(geometry.header.height).toBe(width < 1024 ? 60 : 64);
    expect(geometry.logo.width).toBe(geometry.logo.height);
    const overlaps = (a: typeof geometry.name, b: typeof geometry.name) =>
      a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    expect(overlaps(geometry.name, geometry.badge)).toBe(false);
    expect(overlaps(geometry.name, geometry.edit)).toBe(false);
    expect(overlaps(geometry.logo, geometry.edit)).toBe(false);
    for (const row of geometry.rows) {
      expect(row.icon.width).toBe(36);
      expect(row.icon.height).toBe(36);
      expect(row.font).toBe("15px");
      expect(
        Math.abs(
          row.chevron.y + row.chevron.height / 2 - (row.row.y + row.row.height / 2),
        ),
      ).toBeLessThanOrEqual(1);
      expect(row.icon.x).toBe(geometry.rows[0].icon.x);
      expect(row.chevron.x).toBe(geometry.rows[0].chevron.x);
    }
    const nav = page.getByRole("navigation", {
      name: width < 1024 ? "Mobile vendor navigation" : "Vendor navigation",
      exact: true,
    });
    await expect(
      nav.getByRole("link", { name: "Business", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Bookings", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Insights", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastSection = await page
      .getByRole("region", { name: "Billing & Legal", exact: true })
      .boundingBox();
    if (width < 1024) {
      const navBox = await nav.boundingBox();
      expect(lastSection!.y + lastSection!.height).toBeLessThan(navBox!.y);
      expect(Math.round(navBox!.y + navBox!.height)).toBe(height);
    }
    await noOverflow(page);
    const phase1Path = `output/playwright/my-profile-phase-1/${testInfo.project.name}-geometry.json`;
    if (fs.existsSync(phase1Path)) {
      const previous = JSON.parse(fs.readFileSync(phase1Path, "utf8")).find(
        (entry: { width: number }) => entry.width === width,
      );
      if (previous) {
        expect(geometry.logo).toEqual(previous.logo);
        expect(geometry.name).toEqual(previous.name);
        expect(geometry.edit).toEqual(previous.edit);
        expect(geometry.rows).toEqual(previous.rows);
      }
    }
    measurements.push({ width, height, ...geometry });

    const beforePath = `output/playwright/my-profile-phase-1/before/profile-${testInfo.project.name}-${width}-shell.json`;
    if (fs.existsSync(beforePath)) {
      const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
      const normalize = (s: string) =>
        s.replace(/\s(?:id|aria-controls|aria-labelledby)="[^"]*"/g, "");
      expect(normalize(await page.locator("header").evaluate((e) => e.outerHTML))).toBe(
        normalize(before.html),
      );
    }
    if (screenshotWidths.has(width)) {
      const prefix = `${artifactRoot}/${testInfo.project.name}-${width}`;
      await settlePrefetches();
      await fullPageCapture(page, `${prefix}-full.png`);
      if (testInfo.project.name === "chromium") {
        await page.evaluate(() => window.scrollTo(0, 0));
        const summary = await page.locator("[data-profile-summary]").boundingBox();
        await page.screenshot({
          path: `${prefix}-top.png`,
          clip: {
            x: 0,
            y: 0,
            width,
            height: Math.ceil(summary!.y + summary!.height + 12),
          },
          animations: "disabled",
          style: captureStyle,
        });
        for (const [name, suffix] of [
          ["Account", "account"],
          ["Billing & Legal", "billing-legal"],
        ]) {
          const section = page.getByRole("region", { name, exact: true });
          // Keep the detail between the existing fixed header and bottom nav;
          // locator screenshot alone can leave a fixed overlay over its crop.
          await section.evaluate((element) =>
            window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80),
          );
          await section.screenshot({
            path: `${prefix}-${suffix}.png`,
            animations: "disabled",
            style: captureStyle,
          });
        }
      }
    }
  }
  await settlePrefetches();
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${artifactRoot}/${testInfo.project.name}-geometry.json`,
    JSON.stringify(measurements, null, 2),
  );
});

test("missing rows stay non-operational while existing features and shell controls remain available", async ({
  page,
}) => {
  await page.goto("/business");
  await ready(page);
  await expect(
    page.locator("main form, main input, main select, main textarea"),
  ).toHaveCount(0);
  await expect(page.locator("main button")).toHaveCount(0);
  await expect(page.locator("main a")).toHaveCount(5);
  const writes: string[] = [];
  page.on("request", (req) => {
    if (
      new URL(req.url()).pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(req.method())
    )
      writes.push(req.url());
  });
  for (const row of await page.locator("main li:not(:has(a))").all()) {
    await row.click();
    await expect(page).toHaveURL(/\/business$/);
  }
  expect(writes).toEqual([]);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await bell.click();
  await expect(
    page.getByRole("dialog", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bell).toBeFocused();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Profile & account" })).toHaveAttribute(
    "href",
    "/settings",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /Switch business. Current business/ })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("menuitem", { name: /Northside Events/ })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("long real-data shapes wrap and missing optional data stays absent", async ({
  page,
  request,
}, testInfo) => {
  await request.post(`${fixtureOrigin}/fixture/profile`, {
    data: {
      name: "Harbour Studio for Independent Operators and GrowingTeamsWithoutAnyWordBreaksAcrossTheWholeBusinessName",
      category: "Creative services and professional events across multiple locations",
    },
  });
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    await page.goto("/business");
    await ready(page);
    await noOverflow(page);
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    if (width === 320 && testInfo.project.name === "chromium")
      await fullPageCapture(page, `${artifactRoot}/chromium-320-long-name.png`);
  }
  await request.post(`${fixtureOrigin}/fixture/profile`, {
    data: { logo_path: null, category: "", created_at: "not-a-date" },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/business");
  await ready(page);
  await expect(
    page.locator("[data-profile-summary] img, [data-profile-summary] time"),
  ).toHaveCount(0);
  await expect(
    page
      .getByLabel("Harbour Studio logo", { exact: true })
      .filter({ visible: true })
      .last(),
  ).toHaveText("HS");
  await expect(page.locator("[data-profile-summary]")).not.toContainText("Member since");
  await noOverflow(page);
  if (testInfo.project.name === "chromium")
    await fullPageCapture(page, `${artifactRoot}/chromium-390-optional-data.png`);
});
