import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, test, type APIResponse } from "@playwright/test";

const fixtureOrigin = "http://127.0.0.1:55441";
const crawlers = [
  ["WhatsApp Android", "WhatsApp/2.26.1 A"],
  ["WhatsApp iOS", "WhatsApp/2.26.1 i"],
  [
    "Apple preview",
    "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
  ],
  ["Meta", "facebookexternalhit/1.1"],
  ["X", "Twitterbot/1.0"],
] as const;
function privacy(response: APIResponse) {
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
}
function meta(head: string, key: string) {
  return [...head.matchAll(/<meta\b[^>]*>/g)]
    .filter(([tag]) => tag.includes(`property="${key}"`) || tag.includes(`name="${key}"`))
    .map(([tag]) => tag.match(/content="([^"]*)"/)?.[1]);
}

test.beforeEach(async ({ request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  fs.mkdirSync("output/playwright/my-profile-phase-2", { recursive: true });
});

test("anonymous crawlers receive one booking-owned PNG in blocking head metadata without side effects", async ({
  request,
}, testInfo) => {
  test.setTimeout(120000);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const evidence = [];
  for (const [client, userAgent] of crawlers) {
    for (const [token, previewId, name, otherName] of [
      [fixture.tokenA, fixture.previewA, "Harbour Studio", "Northside Events"],
      [fixture.tokenB, fixture.previewB, "Northside Events", "Harbour Studio"],
    ]) {
      // Deliberately conflicting vendor cookie must never select preview identity.
      const response = await request.get(`/c/${token}`, {
        headers: {
          "User-Agent": userAgent,
          Cookie: `my-customers-current-business=${fixture.otherBusinessId}`,
        },
      });
      expect(response.status()).toBe(200);
      privacy(response);
      const html = await response.text();
      const head = html.slice(0, html.indexOf("</head>"));
      expect(meta(head, "og:title")).toEqual([`Confirm your booking with ${name}`]);
      expect(meta(head, "og:description")).toEqual([
        `Review and confirm your booking with ${name}.`,
      ]);
      expect(meta(head, "og:image")).toEqual([
        `https://mykustomers.com/social/confirmation/${previewId}`,
      ]);
      expect(meta(head, "og:image:type")).toEqual(["image/png"]);
      expect(meta(head, "og:image:width")).toEqual(["1200"]);
      expect(meta(head, "og:image:height")).toEqual(["630"]);
      expect(meta(head, "twitter:card")).toEqual(["summary_large_image"]);
      expect(meta(head, "og:url")).toEqual([]);
      expect(head).not.toContain(token);
      expect(head).not.toContain(createHash("sha256").update(token).digest("hex"));
      expect(head).not.toContain(otherName);
      expect(html).not.toContain("Review your order");
      expect(html).not.toContain("/api/confirmation/open");
      const image = await request.get(`/social/confirmation/${previewId}`, {
        headers: { "User-Agent": userAgent },
      });
      expect(image.status()).toBe(200);
      privacy(image);
      expect(image.headers()["content-type"]).toBe("image/png");
      const bytes = await image.body();
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: "png",
        width: 1200,
        height: 630,
      });
      expect(bytes.length).toBeLessThan(500000);
      if (client === "WhatsApp Android")
        fs.writeFileSync(
          `output/playwright/my-profile-phase-2/${testInfo.project.name}-og-${name.startsWith("Harbour") ? "a" : "b"}.png`,
          bytes,
        );
      const open = await request.post("/api/confirmation/open", {
        headers: { "User-Agent": userAgent },
        data: { token },
      });
      expect(open.status()).toBe(204);
      evidence.push({
        client,
        business: name,
        blockingHead: "PASS",
        png: "1200x630",
        privacy: "PASS",
      });
    }
  }
  const state = await (await request.get(`${fixtureOrigin}/fixture/state`)).json();
  expect(state.writes).toEqual([]);
  fs.writeFileSync(
    `output/playwright/my-profile-phase-2/${testInfo.project.name}-social-metadata.json`,
    JSON.stringify(
      { evidence, crawlerWrites: 0, physicalDeviceVerification: false },
      null,
      2,
    ),
  );
});

test("image identity ignores caller substitutions and degrades to business initials", async ({
  request,
}, testInfo) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  const getImage = async (suffix = "") => {
    const response = await request.get(
      `/social/confirmation/${fixture.previewA}${suffix}`,
    );
    expect(response.status()).toBe(200);
    privacy(response);
    const body = await response.body();
    expect(await sharp(body).metadata()).toMatchObject({
      width: 1200,
      height: 630,
      format: "png",
    });
    return body;
  };
  const original = await getImage();
  expect(
    await getImage(
      `?business=${fixture.otherBusinessId}&name=Other&logo=https://example.invalid/image.png`,
    ),
  ).toEqual(original);
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { logoFailure: true },
  });
  const unavailableLogo = await getImage();
  expect(unavailableLogo).not.toEqual(original);
  await request.post(`${fixtureOrigin}/fixture/profile`, { data: { logo_path: null } });
  expect(await getImage()).toEqual(unavailableLogo);
  fs.writeFileSync(
    `output/playwright/my-profile-phase-2/${testInfo.project.name}-og-no-logo.png`,
    unavailableLogo,
  );
  await request.post(`${fixtureOrigin}/fixture/profile`, {
    data: {
      logo_path: null,
      name: "Harbour Studio for Independent Operators and GrowingTeamsWithoutAnyWordBreaksAcrossTheWholeBusinessName"
        .repeat(2)
        .slice(0, 160),
    },
  });
  fs.writeFileSync(
    `output/playwright/my-profile-phase-2/${testInfo.project.name}-og-long-name.png`,
    await getImage(),
  );
});

test("revoked, expired, mismatched and malformed previews fail closed", async ({
  request,
}) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  for (const link of [
    { revoked_at: "2026-01-01T00:00:00Z" },
    { expires_at: "2020-01-01T00:00:00Z" },
    { business_id: fixture.otherBusinessId },
  ]) {
    await request.get(`${fixtureOrigin}/fixture/reset`);
    await request.post(`${fixtureOrigin}/fixture/scenario`, { data: { link } });
    const response = await request.get(`/social/confirmation/${fixture.previewA}`);
    expect(response.status()).toBe(404);
    privacy(response);
    expect((await response.body()).length).toBe(0);
    const html = await (
      await request.get(`/c/${fixture.tokenA}`, {
        headers: { "User-Agent": "WhatsApp/2.26.1 A" },
      })
    ).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(meta(head, "og:title")).toEqual([
      "Secure booking confirmation | My Kustomers",
    ]);
    expect(head).not.toContain("Harbour Studio");
  }
  for (const id of [
    "invalid",
    fixture.tokenA,
    createHash("sha256").update(fixture.tokenA).digest("hex"),
  ]) {
    const response = await request.get(`/social/confirmation/${id}`);
    expect(response.status()).toBe(404);
    privacy(response);
  }
  expect(
    (await (await request.get(`${fixtureOrigin}/fixture/state`)).json()).writes,
  ).toEqual([]);
});

test("the public root preserves platform identity for each social crawler", async ({
  request,
}) => {
  for (const [, userAgent] of crawlers) {
    const response = await request.get("/", { headers: { "User-Agent": userAgent } });
    expect(response.status()).toBe(200);
    const html = await response.text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(meta(head, "og:title")).toEqual([
      "My Kustomers — Booking &amp; Customer Management for Service Businesses",
    ]);
    expect(meta(head, "og:url")).toEqual(["https://mykustomers.com"]);
    expect(meta(head, "og:image")).toEqual([
      "https://mykustomers.com/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
    ]);
  }
});
