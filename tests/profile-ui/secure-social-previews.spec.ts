import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";

const fixtures = "http://127.0.0.1:55441";
const output = "output/playwright/secure-social-previews";
const crawlers = [
  "WhatsApp/2.26.1 A",
  "WhatsApp/2.26.1 i",
  "TelegramBot",
  "Applebot/0.1",
  "facebookexternalhit/1.1",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding 1.0",
  "Discordbot/2.0",
  "LinkedInBot/1.0",
];

test.beforeEach(async ({ request }) => {
  await request.get(`${fixtures}/fixture/reset`);
  fs.mkdirSync(output, { recursive: true });
});

for (const kind of ["confirmation", "feedback"] as const) {
  test(`${kind}: crawler metadata and images leave fresh evidence untouched; a browser still records first view`, async ({
    request,
    page,
  }, info) => {
    test.setTimeout(120000);
    const session = await (await request.get(`${fixtures}/fixture/session`)).json();
    const capability =
      kind === "confirmation"
        ? { token: session.tokenA, id: session.previewA }
        : session.capabilities.feedback[0];
    const path = `/${kind === "confirmation" ? "c" : "f"}/${capability.token}`;
    const before = await (await request.get(`${fixtures}/fixture/state`)).json();
    expect(before.capabilityState[kind][0]).toMatchObject({
      first_viewed_at: null,
      used_at: null,
      revoked_at: null,
      share_count: 0,
      last_shared_at: null,
    });
    for (const userAgent of crawlers) {
      const response = await request.get(path, { headers: { "User-Agent": userAgent } });
      expect(response.status()).toBe(200);
      const html = await response.text();
      const head = html.split("</head>")[0];
      expect(head).toContain(`https://mykustomers.com/social/${kind}/${capability.id}`);
      expect(head).toContain('content="summary_large_image"');
      expect(head).not.toContain(capability.token);
      expect(head).not.toContain(
        createHash("sha256").update(capability.token).digest("hex"),
      );
      expect(html).not.toMatch(
        /Private Customer|PRIVATE-REFERENCE|Private booking details|Private description|45900|data-feedback-form|\/api\/(confirmation|feedback)\/open/,
      );
      const image = await request.get(`/social/${kind}/${capability.id}`, {
        headers: { "User-Agent": userAgent },
      });
      expect(image.status()).toBe(200);
      expect(await sharp(await image.body()).metadata()).toMatchObject({
        format: "png",
        width: 1200,
        height: 630,
      });
      expect(
        (
          await request.post(`/api/${kind}/open`, {
            headers: { "User-Agent": userAgent },
            data: { token: capability.token },
          })
        ).status(),
      ).toBe(204);
    }
    const afterCrawlers = await (await request.get(`${fixtures}/fixture/state`)).json();
    expect(afterCrawlers).toEqual(before);
    expect(afterCrawlers.writes).toEqual([]);
    expect(afterCrawlers.lifecycleEvents).toEqual([]);
    await page.goto(path);
    await expect(
      page.getByText("Private booking details", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await (await request.get(`${fixtures}/fixture/state`)).json()).capabilityState[
            kind
          ][0].first_viewed_at,
      )
      .not.toBeNull();
    const opened = await (await request.get(`${fixtures}/fixture/state`)).json();
    expect(
      opened.writes.filter(
        (write: { table: string }) => write.table === `record_${kind}_link_open`,
      ),
    ).toHaveLength(1);
    expect(opened.capabilityState[kind][0]).toEqual({
      ...before.capabilityState[kind][0],
      first_viewed_at: expect.any(String),
    });
    expect(opened.lifecycleEvents).toEqual([]);
    fs.writeFileSync(
      `${output}/${info.project.name}-${kind}-crawler-evidence.json`,
      JSON.stringify(
        {
          clients: crawlers.length,
          before: before.capabilityState[kind][0],
          afterCrawlers: afterCrawlers.capabilityState[kind][0],
          crawlerWrites: afterCrawlers.writes,
          lifecycleEvents: opened.lifecycleEvents,
          browser: opened.capabilityState[kind][0],
          browserOpenCalls: 1,
        },
        null,
        2,
      ),
    );
  });

  test(`${kind}: approved cards preserve logo shapes and readable identity at three sizes`, async ({
    request,
  }, info) => {
    test.setTimeout(120000);
    const session = await (await request.get(`${fixtures}/fixture/session`)).json();
    const id =
      kind === "confirmation" ? session.previewA : session.capabilities.feedback[0].id;
    const platform = fs.readFileSync(
      "public/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
    );
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
      "unbroken-name",
    ]) {
      await request.post(`${fixtures}/fixture/scenario`, { data: { logoShape: shape } });
      await request.post(`${fixtures}/fixture/profile`, {
        data: {
          name:
            shape === "long-name"
              ? "Harbour Studio International Creative Services and Bespoke Event Experiences "
                  .repeat(3)
                  .slice(0, 160)
              : shape === "unbroken-name"
                ? "Harbour".repeat(23).slice(0, 160)
                : "Harbour Studio",
          ...(shape === "none" ? { logo_path: null } : {}),
        },
      });
      const response = await request.get(`/social/${kind}/${id}`);
      expect(response.status()).toBe(200);
      const bytes = await response.body();
      expect(bytes).not.toEqual(platform); // A silent render failure must fail this test.
      expect(bytes.length).toBeLessThan(500000);
      const prefix = `${output}/${info.project.name}-${kind}-${shape}`;
      fs.writeFileSync(`${prefix}-1200.png`, bytes);
      await sharp(bytes).resize(600, 315).toFile(`${prefix}-600.png`);
      await sharp(bytes).resize(300, 158).toFile(`${prefix}-300.png`);
      if (!["none", "long-name", "unbroken-name"].includes(shape)) {
        // The safe logo projection must fill its top-left tile without cropping
        // either wide or tall artwork. Keep this geometry check out of text/illustration.
        const { data, info: raw } = await sharp(bytes)
          .extract({ left: 48, top: 40, width: 180, height: 180 })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        let minX = 180,
          maxX = 0,
          minY = 180,
          maxY = 0;
        for (let y = 0; y < raw.height; y++)
          for (let x = 0; x < raw.width; x++) {
            const i = (y * raw.width + x) * 3;
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
        expect(minX).toBeGreaterThanOrEqual(5);
        expect(minY).toBeGreaterThanOrEqual(5);
        expect(maxX).toBeLessThan(175);
        expect(maxY).toBeLessThan(175);
        expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(155);
      }
    }
    await request.post(`${fixtures}/fixture/profile`, {
      data: { name: "Harbour Studio", logo_path: null },
    });
    const initials = await (await request.get(`/social/${kind}/${id}`)).body();
    await request.post(`${fixtures}/fixture/profile`, {
      data: { name: "Harbour Studio" },
    });
    await request.post(`${fixtures}/fixture/scenario`, { data: { logoFailure: true } });
    expect(await (await request.get(`/social/${kind}/${id}`)).body()).toEqual(initials);
    const generic = await request.get(
      `/social/${kind}?name=Injected&logo=https://example.invalid/private.png`,
    );
    expect(generic.status()).toBe(200);
    expect(await generic.body()).not.toEqual(platform);
    expect(await generic.body()).toEqual(
      await (await request.get(`/social/${kind}`)).body(),
    );
    fs.writeFileSync(
      `${output}/${info.project.name}-${kind}-generic.png`,
      await generic.body(),
    );
    expect(
      (await (await request.get(`${fixtures}/fixture/state`)).json()).writes,
    ).toEqual([]);
  });
}
