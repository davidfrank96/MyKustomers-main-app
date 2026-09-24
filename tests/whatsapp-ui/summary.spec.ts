import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
const origin = "http://127.0.0.1:55441";
const sizes = [
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
const states = [
  {
    name: "email-only",
    email: true,
    whatsapp: false,
    stopped: null,
    entitled: true,
    labels: ["Selected", "Not selected"],
  },
  {
    name: "both",
    email: true,
    whatsapp: true,
    stopped: null,
    entitled: true,
    labels: ["Selected", "Selected"],
  },
  {
    name: "whatsapp-only",
    email: false,
    whatsapp: true,
    stopped: null,
    entitled: true,
    labels: ["Not selected", "Selected"],
  },
  {
    name: "both-stopped",
    email: false,
    whatsapp: false,
    stopped: "2026-09-24T00:00:00Z",
    entitled: true,
    labels: ["Not selected", "Updates stopped"],
  },
  {
    name: "paused",
    email: true,
    whatsapp: true,
    stopped: null,
    entitled: false,
    labels: ["Selected", "Future updates paused"],
  },
];
// Check at the real viewport first. Temporarily move the fixed shell to the
// capture edges so a tall element screenshot does not overlay its own content.
async function capture(page: Page, group: Locator, path: string) {
  const viewport = page.viewportSize()!;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.ceil(height) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await group.screenshot({ path, animations: "disabled" });
  await page.setViewportSize(viewport);
}
test.beforeEach(async ({ context, request }) => {
  await request.get(`${origin}/fixture/reset`);
  const fixture = await (await request.get(`${origin}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: fixture.cookie, domain: "127.0.0.1", path: "/" },
    {
      name: "my-customers-current-business",
      value: fixture.businessId,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
});
for (const state of states) {
  test(`summary stays read-only and aligned: ${state.name}`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${origin}/fixture/scenario`, {
      data: {
        whatsappSummaryPreferences: {
          email_enabled: state.email,
          whatsapp_enabled: state.whatsapp,
          disabled_at: state.stopped,
        },
        whatsappSummaryHasEvent: false,
        whatsappEntitled: state.entitled,
      },
    });
    await page.goto("/bookings/30000000-0000-4000-8000-000000000001");
    await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.waitForLoadState("networkidle");
    const group = page.getByRole("region", { name: "Customer updates", exact: true });
    await expect(group).toBeVisible();
    await expect(
      group.getByText("Choose how the customer receives updates for this booking.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(group.getByRole("definition")).toHaveText(state.labels);
    const rows = group.locator("dl > div");
    await expect(rows).toHaveCount(2);
    await expect(
      rows.locator("button, input, a, [role=button], [role=checkbox]"),
    ).toHaveCount(0);
    await expect(
      group.getByRole("button", { name: "Stop WhatsApp updates" }),
    ).toHaveCount(state.whatsapp ? 1 : 0);
    const evidence = [];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await group.evaluate((element) => element.scrollIntoView({ block: "center" }));
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const boxes = await rows.evaluateAll((elements) =>
        elements.map((element) => {
          const row = element.getBoundingClientRect();
          const pill = element.querySelector("dd > span")!;
          const p = pill.getBoundingClientRect();
          return {
            width: row.width,
            height: row.height,
            pillHeight: p.height,
            contained:
              p.left >= row.left &&
              p.right <= row.right &&
              p.top >= row.top &&
              p.bottom <= row.bottom,
            noWrap: getComputedStyle(pill).whiteSpace === "nowrap",
            ownOverflow: element.scrollWidth > element.clientWidth,
          };
        }),
      );
      expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThanOrEqual(1);
      for (const box of boxes) {
        expect(box.contained).toBe(true);
        expect(box.noWrap).toBe(true);
        expect(box.ownOverflow).toBe(false);
        expect(box.pillHeight).toBe(32);
      }
      evidence.push({ width, height, rows: boxes });
      if ([320, 390, 430, 768, 1024, 1440].includes(width))
        await capture(
          page,
          group,
          `output/playwright/customer-updates-summary/${info.project.name}-${state.name}-${width}.png`,
        );
    }
    expect(errors).toEqual([]);
    fs.mkdirSync("output/playwright/customer-updates-summary", { recursive: true });
    fs.writeFileSync(
      `output/playwright/customer-updates-summary/${info.project.name}-${state.name}-geometry.json`,
      JSON.stringify(evidence, null, 2),
    );
  });
}
