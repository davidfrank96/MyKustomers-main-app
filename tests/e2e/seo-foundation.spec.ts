import { expect, test, type Page } from "./support/test";

const canonicalOrigin = "https://mykustomers.com";

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll, `${label} overflowed horizontally`).toBeLessThanOrEqual(
    widths.client + 1,
  );
}

test.describe("SEO Phase 1 foundation", () => {
  test("serves crawlable homepage metadata and truthful server-rendered JSON-LD", async ({
    page,
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Booking &amp; Customer Management for Small Businesses");
    expect(html).toContain("Built for Nigerian service businesses");
    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toMatch(/mycustomers\.com/i);

    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalOrigin,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      canonicalOrigin,
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "My Kustomers",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Built for growing service businesses in Nigeria",
      }),
    ).toBeVisible();

    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(schemas.join(" ")).toContain('"@type":"Organization"');
    expect(schemas.join(" ")).toContain('"@type":"WebSite"');
    expect(schemas.join(" ")).toContain('"@type":"WebApplication"');
    expect(schemas.join(" ")).not.toMatch(/aggregateRating|"review"|"offers"/);
  });

  test("serves a one-URL sitemap and canonical Production robots policy", async ({
    request,
  }) => {
    const [robotsResponse, sitemapResponse] = await Promise.all([
      request.get("/robots.txt"),
      request.get("/sitemap.xml"),
    ]);
    expect(robotsResponse.status()).toBe(200);
    expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
    expect(await robotsResponse.text()).toContain(
      `Sitemap: ${canonicalOrigin}/sitemap.xml`,
    );

    expect(sitemapResponse.status()).toBe(200);
    expect(sitemapResponse.headers()["content-type"]).toContain("application/xml");
    const sitemap = await sitemapResponse.text();
    expect(sitemap.match(/<loc>/g)).toHaveLength(1);
    expect(sitemap).toContain(`<loc>${canonicalOrigin}/</loc>`);
    expect(sitemap).not.toMatch(
      /login|signup|dashboard|admin|\/c\/|\/a\/|\/x\/|\/f\/|vercel\.app/,
    );
  });

  test("keeps auth, workspace, admin, and capability responses out of search", async ({
    request,
  }) => {
    for (const path of [
      "/login",
      "/signup",
      "/onboarding",
      "/dashboard",
      "/bookings",
      "/customers",
      "/admin",
      "/c/seo-private-token",
      "/a/seo-private-token",
      "/x/seo-private-token",
      "/f/seo-private-token",
    ]) {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"], path).toContain("noindex");
      const html = await response.text();
      expect(html, path).not.toContain(`<loc>${canonicalOrigin}${path}</loc>`);

      if (/^\/(?:a|c|f|x)\//.test(path)) {
        // Next's development server replaces route Cache-Control with its own
        // non-persistent no-cache policy. Production `next start` is separately
        // smoke-tested and must return the configured no-store directive.
        expect(response.headers()["cache-control"], path).toMatch(
          /(?:no-store|no-cache)/,
        );
        expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
        const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? "";
        expect(head, path).not.toContain('rel="canonical"');
        expect(head, path).not.toContain('property="og:url"');
        expect(head, path).not.toContain("seo-private-token");
      }
    }
  });

  test("returns a real noindex 404", async ({ request }) => {
    const response = await request.get("/seo-phase-one-missing-page");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('content="noindex');
  });

  test("keeps the expanded public content responsive", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Chromium owns the width gate.");

    for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
      await expectNoHorizontalOverflow(page, `homepage at ${width}px`);
    }
  });
});
