import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const origin = "http://127.0.0.1:55441";
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

test("a late validation response does not steal focus from an active edit", async ({
  page,
}) => {
  await page.goto("/bookings/new");
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForLoadState("networkidle");
  let release!: () => void;
  let arrived!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/*", async (route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"])
      return route.continue();
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Create booking", exact: true }).click();
  await responseReady;
  const title = page.locator("#title");
  await title.click();
  await title.fill("Typing while validation returns");
  await expect(title).toBeFocused();
  await page.keyboard.type(" before");
  await expect(title).toHaveValue("Typing while validation returns before");
  release();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(title).toBeFocused();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(title).toBeFocused();
  await page.keyboard.type(" continues");
  await expect(title).toHaveValue("Typing while validation returns before continues");
});

const viewports = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
  [768, 1024],
];

for (const [width, height] of viewports) {
  test(`validation corrections and input identity stay stable at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/bookings/new");
    await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.getByRole("button", { name: "Add new customer", exact: true }).click();
    await page.getByRole("button", { name: "Create booking", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.locator("#newCustomerName")).toBeFocused();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [id, value] of [
      ["newCustomerName", "Synthetic Customer"],
      ["newCustomerEmail", "fixture@example.invalid"],
      ["newCustomerPhone", "+15555550123"],
      ["title", "Synthetic title"],
      ["description", "Synthetic description"],
      ["internalNotes", "Synthetic internal note"],
    ]) {
      const input = page.locator(`#${id}`);
      const original = await input.elementHandle();
      await input.click();
      await input.fill("");
      await page.keyboard.type(value);
      await expect(input).toHaveValue(value);
      await page.keyboard.press("Backspace");
      await page.keyboard.insertText(value.slice(-1));
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Delete");
      await page.keyboard.insertText(value.slice(-1));
      await expect(input).toHaveValue(value);
      expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
      await expect(input).toBeFocused();
    }
    const date = page.locator("#scheduledFor");
    await date.fill("2035-09-25T16:45");
    await expect(
      date
        .locator("xpath=ancestor::form")
        .locator("input[type=hidden][name=scheduledFor]"),
    ).toHaveValue(new Date("2035-09-25T16:45").toISOString());
    for (const id of ["totalAmount", "depositAmount"]) {
      const input = page.locator(`#${id}`);
      await input.click();
      await input.fill("");
      await page.keyboard.type("1234.50");
      await expect(input).toHaveValue("1,234.50");
      await expect(page.locator(`input[type=hidden][name=${id}]`)).toHaveValue("1234.50");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Backspace");
      await expect(input).toHaveValue("1,234.0");
      await page.keyboard.insertText("5");
      await expect(input).toHaveValue("1,234.50");
      await input.selectText();
      await page.keyboard.insertText("9,876.25");
      await expect(input).toHaveValue("9,876.25");
      await expect(page.locator(`input[type=hidden][name=${id}]`)).toHaveValue("9876.25");
      await input.fill("");
      await page.keyboard.type("12.");
      await page.locator("#title").click();
      await expect(input).toHaveValue("12");
    }
    await page.getByRole("checkbox", { name: "WhatsApp", exact: true }).check();
    const phone = page.getByLabel("WhatsApp number", { exact: true });
    await phone.click();
    await phone.fill("");
    await page.keyboard.type("+15555550123");
    await expect(phone).toHaveValue("+15555550123");
    // Repeat a genuine server validation failure; no booking is created.
    await page.locator("#title").fill("");
    await page.getByRole("button", { name: "Create booking", exact: true }).click();
    await expect(page.locator("#title")).toHaveAttribute("aria-invalid", "true");
    await page.locator("#title").click();
    await page.keyboard.type("Corrected title");
    await expect(page.locator("#title")).toHaveValue("Corrected title");
    // Emulate viewport contraction/restoration; this is not a physical keyboard claim.
    await page.setViewportSize({ width, height: Math.max(320, height - 260) });
    await expect(page.locator("#title")).toBeFocused();
    await page.locator("#title").blur();
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (width < 768) {
      const nav = page.getByRole("navigation", { name: "Mobile vendor navigation" });
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    }
    await page.screenshot({
      path: `output/playwright/reschedule-safari/${test.info().project.name}-${width}-validation.png`,
    });
    expect(errors).toEqual([]);
  });
}

for (const status of [
  "DRAFT",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]) {
  test(`booking details enforces reschedule availability for ${status}`, async ({
    page,
    request,
  }) => {
    await request.post(`${origin}/fixture/scenario`, {
      data: { booking: { status, scheduled_for: "2020-01-01T12:00:00Z" } },
    });
    await page.goto("/bookings/30000000-0000-4000-8000-000000000001");
    const section = page.locator("#reschedule");
    const trigger = section.getByRole("button").first();
    if ((await trigger.getAttribute("aria-expanded")) === "false") await trigger.click();
    const eligible = !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
    const input = section.getByLabel("New scheduled date");
    const submit = section.getByRole("button", { name: "Reschedule", exact: true });
    if (eligible) {
      await expect(input).toBeEnabled();
      await expect(submit).toBeEnabled();
    } else {
      await expect(input).toBeDisabled();
      await expect(submit).toBeDisabled();
    }
    if (!eligible) {
      await expect(section).toContainText(
        status === "CANCELLED"
          ? "Cancelled bookings cannot be rescheduled."
          : "Rescheduling is no longer available after delivery.",
      );
    } else {
      const node = await input.elementHandle();
      await input.fill("2020-01-02T12:00");
      await section.getByRole("button", { name: "Reschedule", exact: true }).click();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveValue("2020-01-02T12:00");
      await input.fill("2035-09-25T16:45");
      expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
      await expect(section.locator("input[type=hidden][name=scheduledFor]")).toHaveValue(
        new Date("2035-09-25T16:45").toISOString(),
      );
    }
    if (status === "READY") {
      for (const [width, height] of viewports) {
        await page.setViewportSize({ width, height });
        await input.scrollIntoViewIfNeeded();
        await expect(input).toBeVisible();
        const box = await input.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `output/playwright/reschedule-safari/${test.info().project.name}-${width}-reschedule.png`,
        });
      }
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("booking notes and payment correction survive validation and repeated dialog entry", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await request.post(`${origin}/fixture/scenario`, {
    data: {
      paymentFixture: true,
      booking: {
        status: "IN_PROGRESS",
        confirmation_terms_hash: "synthetic-confirmed-terms",
      },
    },
  });
  await page.goto("/bookings/30000000-0000-4000-8000-000000000001");
  await expect(page.locator("[data-pwa-reliability-coordinator]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const details = page.locator("#booking-details");
  if (
    (await details.getByRole("button").first().getAttribute("aria-expanded")) === "false"
  )
    await details.getByRole("button").first().click();
  const notes = details.locator("#internalNotes");
  await notes.fill("Synthetic notes");
  await notes.click();
  await page.keyboard.type(" continued");
  await expect(notes).toHaveValue("Synthetic notes continued");
  const payments = page.locator("#booking-payments");
  if (
    (await payments.getByRole("button").first().getAttribute("aria-expanded")) === "false"
  )
    await payments.getByRole("button").first().click();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await payments.getByRole("button", { name: "Record payment", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const amount = dialog.getByLabel("Payment amount");
    await amount.fill("");
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(amount).toBeEnabled();
    const node = await amount.elementHandle();
    await amount.click();
    await page.keyboard.type("12.50");
    await expect(amount).toHaveValue("12.50");
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText("5");
    await expect(amount).toHaveValue("12.55");
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
