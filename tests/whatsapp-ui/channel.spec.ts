import { expect, test, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:55441";
const booking = "30000000-0000-4000-8000-000000000001";
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440];
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
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
test("pilot choices fit ten widths and support keyboard consent", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/bookings/new");
  const group = page.getByRole("group", { name: "Customer updates", exact: true });
  await expect(group).toBeVisible();
  await expect(group.getByRole("checkbox", { name: "Email", exact: true })).toBeChecked();
  const whatsapp = group.getByRole("checkbox", { name: "WhatsApp", exact: true });
  await expect(whatsapp).not.toBeChecked();
  await whatsapp.focus();
  await page.keyboard.press("Space");
  const consent = group.getByRole("checkbox", { name: /customer agreed/ });
  await expect(consent).not.toBeChecked();
  await page.getByLabel("WhatsApp number", { exact: true }).fill("+1 (555) 555-0123");
  await consent.focus();
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await group.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await noOverflow(page);
    await expect(group.getByText("Include + and the country code.")).toBeVisible();
    if ([320, 390, 768, 1440].includes(width))
      await group.screenshot({
        path: `output/playwright/whatsapp-phase2/${info.project.name}-${width}-choices.png`,
      });
  }
  await whatsapp.uncheck();
  await whatsapp.check();
  await expect(consent).not.toBeChecked();
});
test("uncertain status is honest and stopping preserves Email", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto(`/bookings/${booking}`);
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  const group = page.getByRole("region", { name: "Customer updates", exact: true });
  await expect(
    group.getByText("Delivery status uncertain", { exact: true }),
  ).toBeVisible();
  await expect(group).not.toContainText("Delivered");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await group.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await noOverflow(page);
    await expect(
      group.getByRole("button", { name: "Stop WhatsApp updates" }),
    ).toBeVisible();
    if ([320, 390, 768, 1440].includes(width))
      await group.screenshot({
        path: `output/playwright/whatsapp-phase2/${info.project.name}-${width}-status.png`,
      });
  }
  await group.getByRole("button", { name: "Stop WhatsApp updates" }).click();
  await expect(group.getByText("Updates stopped", { exact: true })).toBeVisible();
  await expect(group.getByText("Selected", { exact: true })).toBeVisible();
  await expect(group.getByRole("button")).toHaveCount(0);
});
test("another business has no pilot choices", async ({ page, context, request }) => {
  const fixture = await (await request.get(`${origin}/fixture/session`)).json();
  await context.addCookies([
    {
      name: "my-customers-current-business",
      value: fixture.otherBusinessId,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/bookings/new");
  await expect(
    page.getByRole("heading", { name: "New booking", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Customer updates", exact: true }),
  ).toHaveCount(0);
});
