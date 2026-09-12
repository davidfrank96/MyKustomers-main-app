import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { vendorEmailFixtures } from "../fixtures/vendor-email";

const fixtureOrigin = "http://127.0.0.1:55441";
const output = "output/playwright/vendor-trust-branding";
const families = { feedback: "f", amendment: "a", addon: "x" } as const;
const titles = {
  feedback: "Share feedback with",
  amendment: "Review a booking update from",
  addon: "Review a booking add-on from",
};
const crawlers = [
  "WhatsApp/2.26.1 A",
  "WhatsApp/2.26.1 i",
  "Applebot/0.1",
  "facebookexternalhit/1.1",
  "Twitterbot/1.0",
];
function meta(head: string, key: string) {
  return [...head.matchAll(/<meta\b[^>]*>/g)]
    .filter(([tag]) => tag.includes(`property="${key}"`) || tag.includes(`name="${key}"`))
    .map(([tag]) => tag.match(/content="([^"]*)"/)?.[1]);
}
test.beforeEach(async ({ request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  fs.mkdirSync(output, { recursive: true });
});

test("all customer capabilities resolve the same owning business with read-only crawler metadata", async ({
  request,
}, info) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  for (const [kind, route] of Object.entries(families)) {
    for (const userAgent of crawlers) {
      for (const [index, name] of ["Harbour Studio", "Northside Events"].entries()) {
        const capability = fixture.capabilities[kind][index];
        const response = await request.get(`/${route}/${capability.token}`, {
          headers: {
            "User-Agent": userAgent,
            Cookie: `my-customers-current-business=${index === 0 ? fixture.otherBusinessId : fixture.businessId}`,
          },
        });
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toContain("no-store");
        expect(response.headers()["referrer-policy"]).toBe("no-referrer");
        expect(response.headers()["x-robots-tag"]).toContain("noimageindex");
        const html = await response.text(),
          head = html.slice(0, html.indexOf("</head>"));
        expect(meta(head, "og:title")).toEqual([
          `${titles[kind as keyof typeof titles]} ${name}`,
        ]);
        const imageUrl = `https://mykustomers.com/social/${kind}/${capability.id}`;
        expect(meta(head, "og:image")).toEqual([imageUrl]);
        expect(meta(head, "twitter:image")).toEqual([imageUrl]);
        expect(meta(head, "og:image:alt")).toEqual([`${name} business logo`]);
        expect(meta(head, "og:image:width")).toEqual(["1200"]);
        expect(meta(head, "og:image:height")).toEqual(["630"]);
        expect(head).not.toContain(capability.token);
        expect(head).not.toContain(
          createHash("sha256").update(capability.token).digest("hex"),
        );
        expect(html).not.toMatch(
          /data-feedback-form|\/api\/(feedback|amendment|addon)\/open|Private Customer|private@example.invalid/,
        );
        const image = await request.get(new URL(imageUrl).pathname);
        expect(image.status()).toBe(200);
        expect(image.headers()["cache-control"]).toContain("no-store");
        expect(await sharp(await image.body()).metadata()).toMatchObject({
          format: "png",
          width: 1200,
          height: 630,
        });
        if (userAgent === crawlers[0])
          fs.writeFileSync(
            `${output}/${info.project.name}-${kind}-${index}.png`,
            await image.body(),
          );
        const open = await request.post(`/api/${kind}/open`, {
          headers: { "User-Agent": userAgent },
          data: { token: capability.token },
        });
        expect(open.status()).toBe(204);
      }
    }
  }
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json()).writes,
  ).toEqual([]);
});

test("invalid, expired and revoked capabilities do not disclose vendors and UUIDs grant no actions", async ({
  request,
}) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  for (const [kind, route] of Object.entries(families)) {
    const capability = fixture.capabilities[kind][0];
    for (const record of [
      { expires_at: "2000-01-01" },
      { revoked_at: "2026-01-01", status: "REVOKED" },
      { business_id: fixture.otherBusinessId },
    ]) {
      await request.post(`${fixtureOrigin}/fixture/scenario`, { data: { kind, record } });
      const response = await request.get(`/${route}/${capability.token}`, {
        headers: { "User-Agent": crawlers[0] },
      });
      const head = (await response.text()).split("</head>")[0];
      expect(head).not.toContain("Harbour Studio");
      expect(head).not.toContain("Northside Events");
      expect(meta(head, "og:image")[0]).toContain("/brand/mykustomers/");
      expect((await request.get(`/social/${kind}/${capability.id}`)).status()).toBe(404);
    }
    for (const token of ["invalid", capability.id]) {
      const response = await request.get(`/${route}/${token}`, {
        headers: { "User-Agent": crawlers[0] },
      });
      expect((await response.text()).split("</head>")[0]).not.toContain("Harbour Studio");
    }
    expect((await request.get(`/social/${kind}/${capability.token}`)).status()).toBe(404);
  }
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json()).writes,
  ).toEqual([]);
});

test("large logos preserve artwork and remain centered in full cards and square thumbnails", async ({
  request,
}, info) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  for (const shape of [
    "square",
    "circular",
    "wide",
    "wordmark",
    "tall",
    "transparent",
    "whitespace",
    "none",
    "long-name",
  ]) {
    await request.post(`${fixtureOrigin}/fixture/scenario`, {
      data: { logoShape: shape === "long-name" ? "wordmark" : shape },
    });
    await request.post(`${fixtureOrigin}/fixture/profile`, {
      data: {
        ...(shape === "none" ? { logo_path: null } : {}),
        ...(shape === "long-name"
          ? {
              name: "Harbour Studio International Creative Services and Bespoke Event Experiences "
                .repeat(3)
                .slice(0, 160),
            }
          : {}),
      },
    });
    const response = await request.get(`/social/confirmation/${fixture.previewA}`);
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    expect(bytes.length).toBeLessThan(500000);
    const prefix = `${output}/${info.project.name}-logo-${shape}`;
    fs.writeFileSync(`${prefix}.png`, bytes);
    await sharp(bytes).resize(360, 189).toFile(`${prefix}-small.png`);
    await sharp(bytes)
      .extract({ left: 285, top: 0, width: 630, height: 630 })
      .resize(240, 240)
      .toFile(`${prefix}-square.png`);
    // Central logo remains inside the 630px crop with generous edge clearance.
    const { data, info: raw } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let minX = 1200,
      maxX = 0,
      minY = 630,
      maxY = 0;
    for (let y = 30; y < 420; y++)
      for (let x = 300; x < 900; x++) {
        const i = (y * raw.width + x) * 4;
        if (
          Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]) >
          45
        ) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    expect(minX).toBeGreaterThan(350);
    expect(maxX).toBeLessThan(850);
    if (!["none", "long-name"].includes(shape))
      expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(265);
  }
  for (const kind of Object.keys(families)) {
    await request.post(`${fixtureOrigin}/fixture/profile`, { data: { logo_path: null } });
    expect(
      (await request.get(`/social/${kind}/${fixture.capabilities[kind][0].id}`)).status(),
    ).toBe(200);
  }
});

test("all nine email templates keep a fixed vendor identity across mobile, desktop and blocked images", async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://mykustomers.com/**", async (route) => {
    if (route.request().resourceType() !== "image") return route.abort();
    const response = await request.get(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: response.status(),
      headers: { "Content-Type": response.headers()["content-type"] },
      body: await response.body(),
    });
  });
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { logoShape: "wordmark" },
  });
  for (const width of [320, 360, 390, 430, 600, 700]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [variant, name, logoPath] of [
      ["logo", "Harbour Studio", "20000000-0000-4000-8000-000000000001/logo.webp"],
      [
        "long",
        "Harbour Creative Services ".repeat(2).slice(0, 50),
        "20000000-0000-4000-8000-000000000001/logo.webp",
      ],
      ["fallback", "W".repeat(100), null],
    ] as const) {
      for (const [event, email] of Object.entries(vendorEmailFixtures(name, logoPath))) {
        await page.setContent(email.html, { waitUntil: "load" });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        const nameBox = await page.locator(".vendor-name").boundingBox();
        const avatar = page.locator(logoPath ? ".vendor-logo" : ".vendor-initial");
        const avatarBox = await avatar.boundingBox();
        expect(nameBox).not.toBeNull();
        expect(avatarBox?.width).toBe(52);
        expect(avatarBox?.height).toBe(52);
        expect(
          Math.abs(
            nameBox!.y + nameBox!.height / 2 - (avatarBox!.y + avatarBox!.height / 2),
          ),
        ).toBeLessThanOrEqual(10);
        expect(nameBox!.x).toBeGreaterThan(avatarBox!.x + 52);
        if (logoPath)
          expect(
            await avatar.evaluate((node) => (node as HTMLImageElement).naturalWidth),
          ).toBe(208);
        await expect(page.locator("h1")).toBeVisible();
        const cta = page.locator(
          'a[href*="/c/"],a[href*="/f/"],a[href*="/a/"],a[href*="/x/"]',
        );
        if (await cta.count()) {
          await cta.scrollIntoViewIfNeeded();
          await expect(cta).toBeVisible();
        }
        if (
          (width === 320 || width === 700) &&
          (variant === "logo" || event === "confirmationRequested")
        ) {
          await page.screenshot({
            path: `${output}/${info.project.name}-email-${event}-${variant}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
  }
  const blockedContext = await browser.newContext({
    viewport: { width: 320, height: 900 },
  });
  const blockedPage = await blockedContext.newPage();
  await blockedPage.route("**/*", (route) => route.abort());
  await blockedPage.setViewportSize({ width: 320, height: 900 });
  await blockedPage.setContent(
    vendorEmailFixtures("Harbour Creative Services ".repeat(4).slice(0, 100))
      .confirmationRequested.html,
  );
  await expect(blockedPage.locator(".vendor-name")).toBeVisible();
  expect(
    await blockedPage
      .locator(".vendor-logo")
      .evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBe(0);
  expect((await blockedPage.locator(".vendor-logo").boundingBox())?.width).toBe(52);
  expect(
    await blockedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await blockedPage.screenshot({
    path: `${output}/${info.project.name}-email-blocked-images.png`,
    fullPage: true,
  });
  await blockedContext.close();
  expect(errors).toEqual([]);
});
