import { expect, test, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:55441";
const booking = "30000000-0000-4000-8000-000000000001";
const viewports = [
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
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await group.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await noOverflow(page);
    await expect(group.getByText("Include + and the country code.")).toBeVisible();
    if ([320, 390, 768, 1440].includes(width))
      await group.screenshot({
        path: `output/playwright/whatsapp-phase3/${info.project.name}-${width}-choices.png`,
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
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await group.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await noOverflow(page);
    await expect(
      group.getByRole("button", { name: "Stop WhatsApp updates" }),
    ).toBeVisible();
    if ([320, 390, 768, 1440].includes(width))
      await group.screenshot({
        path: `output/playwright/whatsapp-phase3/${info.project.name}-${width}-status.png`,
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

test("customer and recipient changes never retain stale consent or numbers", async ({
  page,
}) => {
  await page.goto("/bookings/new");
  const whatsapp = page.getByRole("checkbox", { name: "WhatsApp", exact: true });
  const phone = page.getByLabel("WhatsApp number", { exact: true });
  const consent = page.getByRole("checkbox", { name: /customer agreed/ });
  for (const [name, value] of [
    ["International fixture", "+15555550123"],
    ["Local fixture", ""],
    ["Empty fixture", ""],
  ]) {
    await page.getByRole("combobox", { name: "Customer*", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(`^${name} -`) }).click();
    await expect(whatsapp).not.toBeChecked();
    await whatsapp.check();
    await expect(phone).toHaveValue(value);
    await expect(consent).not.toBeChecked();
    await phone.fill("+15555550125");
    await consent.check();
    await phone.fill("+15555550126");
    await expect(consent).not.toBeChecked();
    await consent.check();
  }
  await page.getByRole("button", { name: "Add new customer", exact: true }).click();
  await page.getByLabel("Phone", { exact: true }).fill("+15555550127");
  await expect(whatsapp).not.toBeChecked();
  await whatsapp.check();
  await expect(phone).toHaveValue("+15555550127");
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.getByLabel("Phone", { exact: true }).fill("05555550128");
  await expect(phone).toHaveValue("");
  await expect(consent).not.toBeChecked();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await phone.focus();
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await phone.focus();
  await page.setViewportSize({ width: 390, height: 430 });
  await phone.fill("+15555550129");
  await noOverflow(page);
  await consent.check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "New booking", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile vendor navigation" }),
  ).toBeVisible();
  await noOverflow(page);
});

test("Settings and Admin grant/revoke fit the product and preserve history", async ({
  page,
  request,
}, info) => {
  test.setTimeout(150000);
  await page.goto("/settings");
  await expect(
    page.getByText("Available for this business", { exact: true }),
  ).toBeVisible();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `output/playwright/whatsapp-phase3/${info.project.name}-${width}-settings.png`,
        fullPage: true,
      });
  }
  await request.post(`${origin}/fixture/scenario`, { data: { platformAdmin: true } });
  await page.goto("/admin/businesses/20000000-0000-4000-8000-000000000001");
  await expect(page.getByText("Business features", { exact: true })).toBeVisible();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: `output/playwright/whatsapp-phase3/${info.project.name}-${width}-admin.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Disable feature", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason", { exact: true }).fill("Synthetic revoke test");
  await dialog.getByRole("button", { name: "Disable feature", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enable feature", exact: true }),
  ).toBeVisible();
  await page.goto("/bookings/new");
  await expect(
    page.getByRole("group", { name: "Customer updates", exact: true }),
  ).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("WhatsApp customer updates", { exact: true })).toHaveCount(
    0,
  );
  await page.goto(`/bookings/${booking}`);
  await expect(
    page.getByText("Delivery status uncertain", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Future updates paused", { exact: true })).toBeVisible();
  await page.goto("/admin/businesses/20000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Enable feature", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason", { exact: true }).fill("Synthetic grant test");
  await dialog.getByRole("button", { name: "Enable feature", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Disable feature", exact: true }),
  ).toBeVisible();
  await page.goto("/bookings/new");
  await expect(
    page.getByRole("checkbox", { name: "WhatsApp", exact: true }),
  ).not.toBeChecked();
});
