import { expect, test } from "@playwright/test";
const fixture = "http://127.0.0.1:55441";
const gateway = "https://127.0.0.1:55443";
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
test.beforeEach(async ({ context, request }) => {
  await request.get(`${fixture}/fixture/reset`);
  await request.post(`${fixture}/fixture/scenario`, { data: { platformAdmin: true } });
  await request.post(`${gateway}/fixture`, { ignoreHTTPSErrors: true, data: {} });
  const session = await (await request.get(`${fixture}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: session.cookie, domain: "127.0.0.1", path: "/" },
  ]);
});
test("Admin sender, queue, access and danger confirmation fit the exact matrix", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/admin/whatsapp");
  await expect(
    page.getByRole("heading", { name: "WhatsApp operations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("•••• 0123")).toBeVisible();
  await expect(page.getByText("Gateway control not configured")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "WhatsApp", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Accepted means the provider accepted the message; it is not delivery confirmation. Unknown outcomes are not automatically replayed.",
    ),
  ).toBeVisible();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Replace linked account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("credentials cleared");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `output/playwright/whatsapp-admin/${info.project.name}-390-status.png`,
    fullPage: true,
  });
  expect(await page.content()).not.toMatch(
    /X-Control-Key|WA_AKG_CONTROL_API_KEY|15555550123|s\.whatsapp\.net/,
  );
});
test("pairing QR is ephemeral, polling is bounded and closing stops requests", async ({
  page,
  request,
}) => {
  await request.post(`${gateway}/fixture`, {
    ignoreHTTPSErrors: true,
    data: { status: "LOGGED_OUT", linked: false, paused: true },
  });
  await page.goto("/admin/whatsapp");
  await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Reason").fill("Synthetic local pairing");
  await page.getByRole("button", { name: "Start pairing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open pairing code" })).toBeVisible();
  await page.getByRole("button", { name: "Open pairing code" }).click();
  await expect(page.getByAltText("Temporary WhatsApp pairing code")).toBeVisible();
  let statusRequests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/admin/whatsapp/status")) statusRequests++;
  });
  await expect.poll(() => statusRequests, { timeout: 7000 }).toBeGreaterThan(0);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByAltText("Temporary WhatsApp pairing code")).toHaveCount(0);
  const before = statusRequests;
  await page.waitForTimeout(4500);
  expect(statusRequests).toBe(before);
  // No QR screenshots, video, trace, HTML artifacts or storage dumps.
});
test("connected state removes the pairing code and does not resume automatically", async ({
  page,
  request,
}) => {
  await request.post(`${gateway}/fixture`, {
    ignoreHTTPSErrors: true,
    data: { status: "PAIRING", linked: false, paused: true },
  });
  await page.goto("/admin/whatsapp");
  await page.getByRole("button", { name: "Open pairing code" }).click();
  await expect(page.getByAltText("Temporary WhatsApp pairing code")).toBeVisible();
  await request.post(`${gateway}/fixture`, {
    ignoreHTTPSErrors: true,
    data: { status: "CONNECTED", linked: true, paused: true },
  });
  await expect(page.getByAltText("Temporary WhatsApp pairing code")).toHaveCount(0, {
    timeout: 7000,
  });
  const mutations = await (
    await request.get(`${gateway}/fixture/mutations`, { ignoreHTTPSErrors: true })
  ).json();
  expect(mutations).toEqual([]);
});
test("ordinary vendor is denied page, status and QR", async ({ page, request }) => {
  await request.post(`${fixture}/fixture/scenario`, { data: { platformAdmin: false } });
  await page.goto("/admin/whatsapp");
  await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
  const codes = await page.evaluate(async () =>
    Promise.all(
      ["/api/admin/whatsapp/status", "/api/admin/whatsapp/qr"].map(
        async (path) => (await fetch(path)).status,
      ),
    ),
  );
  expect(codes).toEqual([403, 403]);
});
