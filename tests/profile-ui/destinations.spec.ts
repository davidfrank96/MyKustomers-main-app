import fs from "node:fs";
import { expect, test, type Page, type Request } from "@playwright/test";

const fixtureOrigin = "http://127.0.0.1:55441";
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
const destinations = [
  ["Business information", "information", "Business name"],
  ["Contact information", "contact", "Phone"],
  ["Business address", "address", "Address"],
] as const;

async function captureDestination(page: Page, path: string) {
  const viewport = page.viewportSize()!;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  // Native viewport checks run separately; put fixed navigation at the capture edge.
  await page.setViewportSize({
    width: viewport.width,
    height: Math.max(height, viewport.height),
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await page.setViewportSize(viewport);
}

test.beforeEach(async ({ context, request }) => {
  await request.get(`${fixtureOrigin}/fixture/reset`);
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    { name: "sb-127-auth-token", value: fixture.cookie, domain: "127.0.0.1", path: "/" },
  ]);
});

test("all wired destinations preserve deep links, reload, Back and responsive controls", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pendingPrefetches = new Set<Request>();
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("_rsc")) pendingPrefetches.add(request);
  });
  const finishRequest = (request: Request) => {
    pendingPrefetches.delete(request);
  };
  page.on("requestfinished", finishRequest);
  page.on("requestfailed", finishRequest);
  // Let real background prefetch finish before this matrix immediately unloads it.
  // WebKit otherwise reports the harness's cancelled RSC requests as page errors.
  const settlePrefetches = () => expect.poll(() => pendingPrefetches.size).toBe(0);
  const evidence = [];
  await page.goto("/business");
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    for (const [label, section, field] of destinations) {
      const link = page.getByRole("link", { name: label, exact: true });
      await settlePrefetches();
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/business/edit\\?section=${section}$`));
      await expect(page.getByLabel(field, { exact: true })).toBeVisible();
      await settlePrefetches();
      await page.reload();
      await expect(page.getByLabel(field, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "My Profile", exact: true }),
      ).toBeVisible();
      const nav = page.getByRole("navigation", {
        name: width < 1024 ? "Mobile vendor navigation" : "Vendor navigation",
        exact: true,
      });
      await expect(
        nav.getByRole("link", { name: "Business", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const save = await page
        .getByRole("button", { name: "Save changes", exact: true })
        .boundingBox();
      expect(save!.height).toBeGreaterThanOrEqual(44);
      if (width < 1024)
        expect(save!.y + save!.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);
      if (width === 320 || width === 1440) {
        fs.mkdirSync("output/playwright/my-profile-phase-2", { recursive: true });
        await captureDestination(
          page,
          `output/playwright/my-profile-phase-2/${testInfo.project.name}-${width}-${section}.png`,
        );
      }
      await settlePrefetches();
      await page.goBack();
      await expect(page).toHaveURL(/\/business$/);
      await expect(
        page.getByRole("heading", { name: "My Profile", exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("link", { name: "Notifications", exact: true }).click();
    await expect(page).toHaveURL(/\/settings#notifications$/);
    await expect(
      page.getByRole("checkbox", { name: /Customer confirmations/ }),
    ).toBeEnabled();
    await settlePrefetches();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: /Customer confirmations/ }),
    ).toBeVisible();
    const membershipName = page
      .getByRole("list", { name: "Active business memberships" })
      .getByText("Harbour Studio", { exact: true });
    expect((await membershipName.boundingBox())!.height).toBeLessThanOrEqual(40);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (width === 320 || width === 1440)
      await captureDestination(
        page,
        `output/playwright/my-profile-phase-2/${testInfo.project.name}-${width}-notifications.png`,
      );
    await settlePrefetches();
    await page.goBack();
    await expect(page).toHaveURL(/\/business$/);
    await expect(
      page.getByRole("heading", { name: "My Profile", exact: true }),
    ).toBeVisible();
    evidence.push({
      width,
      height,
      businessInformation: "PASS",
      contact: "PASS",
      address: "PASS",
      notifications: "PASS",
      backReloadKeyboard: "PASS",
    });
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `output/playwright/my-profile-phase-2/${testInfo.project.name}-destinations.json`,
    JSON.stringify(evidence, null, 2),
  );
});

test("existing editor saves all sections, validates and retains its failure state", async ({
  page,
  request,
}) => {
  await page.goto("/business/edit?section=information");
  await page.getByLabel("Business name", { exact: true }).fill("Harbour Studio Updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Business profile updated." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(
    "Harbour Studio Updated",
  );
  await page.goto("/business/edit?section=contact");
  await page.getByLabel("Phone", { exact: true }).fill("+353871234567");
  await page.getByLabel("Business email", { exact: true }).fill("studio@example.invalid");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Business profile updated." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("+353871234567");
  await page.goto("/business/edit?section=address");
  await page.getByLabel("Address", { exact: true }).fill("14 Harbour Road, Dublin");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Business profile updated." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(
    "14 Harbour Road, Dublin",
  );
  await request.post(`${fixtureOrigin}/fixture/scenario`, { data: { failWrites: true } });
  await page.getByLabel("Address", { exact: true }).fill("Unsaved address");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Business details could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(
    "14 Harbour Road, Dublin",
  );
  const state = await (await request.get(`${fixtureOrigin}/fixture/state`)).json();
  expect(state.business.name).toBe("Harbour Studio Updated");
  expect(state.business.address_text).toBe("14 Harbour Road, Dublin");
  await request.post(`${fixtureOrigin}/fixture/scenario`, {
    data: { failWrites: false },
  });
  await page.getByLabel("Address", { exact: true }).fill("Retried address");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Business profile updated." }),
  ).toBeVisible();
  await page.goto("/business/edit?section=information");
  await page.getByLabel("Business name", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect(
    await page
      .getByLabel("Business name", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
});

test("active business, member read-only access and signed-out guard remain intact", async ({
  page,
  context,
  request,
}) => {
  const fixture = await (await request.get(`${fixtureOrigin}/fixture/session`)).json();
  await context.addCookies([
    {
      name: "my-customers-current-business",
      value: fixture.otherBusinessId,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/business");
  await expect(
    page.getByRole("heading", { name: "Northside Events", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(
    "Northside Events",
  );
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Northside Events Updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Business profile updated." }),
  ).toBeVisible();
  const state = await (await request.get(`${fixtureOrigin}/fixture/state`)).json();
  expect(state.business.name).toBe("Harbour Studio");
  expect(state.otherBusiness.name).toBe("Northside Events Updated");
  await request.post(`${fixtureOrigin}/fixture/scenario`, { data: { role: "member" } });
  await page.goto("/business");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Business information", exact: true }).click();
  await expect(page.getByLabel("Business name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await context.clearCookies();
  await page.goto("/business/edit?section=address");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByLabel("Address", { exact: true })).toHaveCount(0);
});

test("Notifications reuses durable preferences and rolls back a failed update", async ({
  page,
  request,
}) => {
  await page.goto("/business");
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  const confirmation = page.getByRole("checkbox", { name: /Customer confirmations/ });
  await expect(confirmation).toBeChecked();
  await confirmation.uncheck();
  await expect(
    page.getByRole("status").filter({ hasText: "Preferences saved." }),
  ).toBeVisible();
  await page.reload();
  await expect(confirmation).not.toBeChecked();
  await request.post(`${fixtureOrigin}/fixture/scenario`, { data: { failWrites: true } });
  await confirmation.check();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not update notifications" }),
  ).toBeVisible();
  await expect(confirmation).not.toBeChecked();
});
