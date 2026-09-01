import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator > 0)
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
  }
}

loadLocalEnv();

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const requiredViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const screenshotDirectory = path.resolve("test-results/mobile-redesign");
const alignmentScreenshotDirectory = path.resolve("test-results/mobile-alignment");
const bookingsScreenshotDirectory = path.resolve("test-results/bookings-mobile-actions");
const newBookingScreenshotDirectory = path.resolve(
  "test-results/new-booking-mobile-redesign",
);
const addCustomerScreenshotDirectory = path.resolve(
  "test-results/add-customer-mobile-redesign",
);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `mobile-redesign-admin-${randomUUID()}`,
      },
    },
  );
}

async function expectNoPageOverflow(page: Page, route: string, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function waitForRouteContent(page: Page, route: string) {
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  await expect(page.getByText("My Customers", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Switch business\. Current business:/ }),
  ).toBeVisible();

  if (route === "/dashboard") {
    await expect(page.getByLabel("Business summary")).toBeVisible();
    await expect(
      page.getByText("Product consultation", { exact: true }).first(),
    ).toBeVisible();
    return;
  }
  if (route === "/bookings") {
    await expect(page.getByLabel("Search bookings")).toBeVisible();
    await expect(page.getByText("Brand identity package", { exact: true })).toBeVisible();
    return;
  }
  if (route === "/bookings/new") {
    await expect(
      page.getByRole("heading", { name: "New booking", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Booking title")).toBeVisible();
    return;
  }
  if (route.startsWith("/bookings/")) {
    await expect(
      page.getByRole("heading", { name: "Brand identity package", exact: true }),
    ).toBeVisible();
    return;
  }
  if (route === "/customers") {
    await expect(page.getByLabel("Search customers")).toBeVisible();
    await expect(page.getByText("Amara Okafor", { exact: true })).toBeVisible();
    return;
  }
  if (route === "/customers/new") {
    await expect(
      page.getByRole("heading", { name: "Add customer", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    return;
  }
  if (route.startsWith("/customers/")) {
    await expect(
      page.getByRole("heading", { name: "Amara Okafor", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save customer" })).toBeVisible();
    return;
  }
  if (route.startsWith("/insights")) {
    await expect(page.getByLabel("Insights date range")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customer activity" })).toBeVisible();
    return;
  }
  if (route === "/business") {
    await expect(
      page.getByRole("heading", { name: "Business", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current business" })).toBeVisible();
    return;
  }
  if (route === "/business/new") {
    await expect(page.getByLabel("Business name")).toBeVisible();
    return;
  }
  if (route.startsWith("/settings")) {
    await expect(
      page.getByRole("heading", { name: "Profile & account", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Active business memberships" }),
    ).toBeVisible();
  }
}

async function expectNewBookingPresentation(page: Page, width: number) {
  const existing = page.getByRole("button", { name: "Use existing customer" });
  const addNew = page.getByRole("button", { name: "Add new customer" });
  const title = page.getByLabel("Booking title");

  await expect(existing).toHaveAttribute("aria-pressed", "true");
  await expect(addNew).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Search existing customers")).toBeVisible();
  await title.fill("Responsive booking values remain intact");

  await addNew.click();
  await expect(addNew).toHaveAttribute("aria-pressed", "true");
  await expect(existing).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Customer name")).toBeVisible();
  await expect(page.getByLabel("Search existing customers")).toHaveCount(0);
  await expect(title).toHaveValue("Responsive booking values remain intact");

  await existing.click();
  await expect(existing).toHaveAttribute("aria-pressed", "true");
  await expect(title).toHaveValue("Responsive booking values remain intact");

  const scheduled = page.getByLabel("Scheduled delivery date");
  expect(
    await scheduled.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    `scheduled delivery control clipped at ${width}px`,
  ).toBe(true);

  const create = page.getByRole("button", { name: "Create booking" });
  await create.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const [createBox, navigationBox] = await Promise.all([
    create.boundingBox(),
    page.getByRole("navigation", { name: "Mobile vendor navigation" }).boundingBox(),
  ]);
  expect(createBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(
    createBox!.y + createBox!.height,
    `create booking CTA overlapped mobile navigation at ${width}px`,
  ).toBeLessThanOrEqual(navigationBox!.y);
}

async function expectNewCustomerPresentation(page: Page, width: number) {
  const name = page.getByLabel("Name", { exact: true });
  const email = page.getByLabel("Email", { exact: true });
  const phone = page.getByLabel("Phone", { exact: true });
  const notes = page.getByLabel("Notes", { exact: true });

  await expect(name).toHaveAttribute("required", "");
  await expect(name).toHaveAttribute("placeholder", "Enter customer name");
  await expect(email).not.toHaveAttribute("required", "");
  await expect(email).toHaveAttribute("placeholder", "Enter email address (optional)");
  await expect(phone).not.toHaveAttribute("required", "");
  await expect(phone).toHaveAttribute("placeholder", "Enter phone number (optional)");
  await expect(notes).toHaveAttribute(
    "placeholder",
    "Add any helpful notes about this customer...",
  );
  await expect(notes).toHaveAttribute("maxlength", "5000");
  await expect(page.getByText("Optional", { exact: true })).toHaveCount(3);
  await expect(page.getByText("0/5000", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute(
    "href",
    "/customers",
  );

  const create = page.getByRole("button", { name: "Create customer" });
  await expect(create).toHaveCSS("color", "rgb(255, 255, 255)");
  await create.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const [createBox, navigationBox] = await Promise.all([
    create.boundingBox(),
    page.getByRole("navigation", { name: "Mobile vendor navigation" }).boundingBox(),
  ]);
  expect(createBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(
    createBox!.y + createBox!.height,
    `create customer CTA overlapped mobile navigation at ${width}px`,
  ).toBeLessThanOrEqual(navigationBox!.y);
}

async function hideDevelopmentChrome(page: Page) {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.parentNode?.removeChild(element);
    });
  });
}

async function expectAttentionSection(page: Page, width: number) {
  await expect(
    page.getByText("Bookings that may need your action now.", { exact: true }),
  ).toBeVisible();

  const statuses = ["dueToday", "overdue", "inProgress", "ready"] as const;
  const accentColors: string[] = [];
  for (const status of statuses) {
    const group = page.locator(`[data-attention-status="${status}"]`);
    await expect(group).toBeVisible();
    accentColors.push(
      await group.evaluate((element) => getComputedStyle(element).borderLeftColor),
    );
    expect(
      await group.evaluate((element) => getComputedStyle(element).overflowY),
    ).not.toMatch(/auto|scroll/);
  }
  expect(new Set(accentColors).size).toBe(statuses.length);

  const overdue = page.locator('[data-attention-status="overdue"]');
  await expect(overdue.getByText("7 bookings", { exact: true })).toBeVisible();
  await expect(overdue.locator('[data-attention-count="7"]')).toHaveText("7");
  await expect(overdue.locator('a[href^="/bookings/"]')).toHaveCount(3);
  await expect(overdue.getByText("Showing 3 of 7", { exact: true })).toBeVisible();
  await expect(
    overdue.getByRole("link", { name: "View all 7 overdue bookings" }),
  ).toHaveAttribute("href", "/bookings?filter=overdue");

  const longTitle = page.getByText(
    "Overdue strategy session with a deliberately long title",
    { exact: true },
  );
  await expect(longTitle).toBeVisible();
  expect(
    await longTitle.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);

  const todayLink = page.getByRole("link", {
    name: "View today's bookings",
    exact: true,
  });
  await todayLink.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const [todayLinkBox, navigationBox] = await Promise.all([
    todayLink.boundingBox(),
    page.getByRole("navigation", { name: "Mobile vendor navigation" }).boundingBox(),
  ]);
  expect(todayLinkBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(
    todayLinkBox!.y + todayLinkBox!.height,
    `today link overlapped mobile navigation at ${width}px`,
  ).toBeLessThanOrEqual(navigationBox!.y);
}

async function expectBookingsMobileActions(page: Page, width: number) {
  const topAction = page.getByRole("link", { name: "New booking", exact: true });
  const createAction = page.getByRole("link", { name: "Create new booking" });
  const backToTop = page.locator('button[aria-label="Back to top"]');
  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobile vendor navigation",
  });
  const search = page.getByLabel("Search bookings");

  await expect(topAction).toHaveAttribute("href", "/bookings/new");
  await expect(createAction).toHaveAttribute("href", "/bookings/new");
  await expect(createAction).toBeVisible();
  await expect(backToTop).toHaveAttribute("aria-hidden", "true");
  await expect(search).toHaveAttribute(
    "placeholder",
    "Search reference, title, or customer",
  );
  expect(await search.evaluate((element) => element.getBoundingClientRect().height)).toBe(
    40,
  );

  for (const [label, href] of [
    ["All", "/bookings?filter=all"],
    ["Active", "/bookings?filter=active"],
    ["Today", "/bookings?filter=today"],
    ["Upcoming", "/bookings?filter=upcoming"],
    ["Overdue", "/bookings?filter=overdue"],
  ] as const) {
    await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "href",
      href,
    );
  }
  await expect(page.getByText("More statuses", { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(480);
  await expect(backToTop).toHaveAttribute("aria-hidden", "false");

  const [actionsBox, navigationBox] = await Promise.all([
    page.locator("[data-bookings-mobile-actions]").boundingBox(),
    mobileNavigation.boundingBox(),
  ]);
  expect(actionsBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(
    actionsBox!.y + actionsBox!.height,
    `booking actions overlapped mobile navigation at ${width}px`,
  ).toBeLessThanOrEqual(navigationBox!.y);
  expect(
    actionsBox!.x,
    `booking actions escaped the viewport at ${width}px`,
  ).toBeGreaterThanOrEqual(width - 80);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const nextPage = page.getByRole("link", { name: "Next", exact: true });
  await nextPage.scrollIntoViewIfNeeded();
  const [nextPageBox, scrolledActionsBox] = await Promise.all([
    nextPage.boundingBox(),
    page.locator("[data-bookings-mobile-actions]").boundingBox(),
  ]);
  expect(nextPageBox).not.toBeNull();
  expect(scrolledActionsBox).not.toBeNull();
  expect(
    nextPageBox!.y + nextPageBox!.height,
    `pagination remained underneath the floating actions at ${width}px`,
  ).toBeLessThanOrEqual(scrolledActionsBox!.y);

  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await expect(backToTop).toHaveAttribute("aria-hidden", "true");

  if (width === 390) {
    await createAction.click();
    await expect(page).toHaveURL(/\/bookings\/new$/);
    await expect(
      page.getByRole("heading", { name: "New booking", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await waitForRouteContent(page, "/bookings");
  }
}

async function expectPrimaryControlContrast(page: Page, name: string) {
  const control = page.getByRole("link", { name, exact: true }).first();
  await expect(control).toBeVisible();
  expect(await control.evaluate((element) => getComputedStyle(element).color)).toBe(
    "rgb(255, 255, 255)",
  );
  const icon = control.locator("svg");
  if ((await icon.count()) > 0) {
    expect(await icon.evaluate((element) => getComputedStyle(element).color)).toBe(
      "rgb(255, 255, 255)",
    );
  }
}

test.describe("approved mobile redesign", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("renders every approved screen without changing product behavior", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "One controlled visual matrix is sufficient.",
    );
    test.setTimeout(420_000);

    const admin = adminClient();
    const fixture = randomUUID().slice(0, 8);
    const email = `mobile-redesign-${Date.now()}-${fixture}@example.com`;
    const password = `Mobile-Redesign-${randomUUID()}-A1`;
    const slug = `mobile-redesign-${fixture}`;
    let userId: string | null = null;
    let businessId: string | null = null;
    let bookingIds: string[] = [];

    try {
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Mobile Redesign Owner" },
      });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const { data: business, error: businessError } = await admin
        .from("businesses")
        .insert({
          name: "North & Pine Studio",
          slug,
          category: "Professional Services",
          description: "A controlled visual verification workspace.",
          phone: "+353 1 555 0199",
          email: "studio@example.com",
          address_text: "Dublin, Ireland",
          onboarding_completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      businessId = business!.id;

      const { error: membershipError } = await admin.from("business_members").insert({
        business_id: businessId,
        user_id: userId,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();

      const { data: customers, error: customerError } = await admin
        .from("customers")
        .insert([
          {
            business_id: businessId,
            name: "Amara Okafor",
            email: "amara@example.com",
            phone: "+234 805 297 0029",
          },
          {
            business_id: businessId,
            name: "Daniel Mensah",
            email: "daniel@example.com",
          },
          {
            business_id: businessId,
            name: "Chioma Adeyemi",
            phone: "+234 806 594 9031",
          },
        ])
        .select("id");
      expect(customerError).toBeNull();
      expect(customers).toHaveLength(3);

      const now = new Date();
      const dueToday = new Date(now);
      dueToday.setHours(23, 59, 59, 999);
      const tomorrow = new Date(now.getTime() + 86_400_000);
      const yesterday = new Date(now.getTime() - 86_400_000);
      const { data: bookings, error: bookingError } = await admin
        .from("bookings")
        .insert([
          {
            business_id: businessId,
            customer_id: customers![0].id,
            title: "Brand identity package",
            description: "Logo and visual identity delivery.",
            currency: "NGN",
            total_amount_minor: 18_500_000,
            deposit_amount_minor: 5_000_000,
            status: "DRAFT",
            scheduled_for: tomorrow.toISOString(),
            created_at: now.toISOString(),
            created_by: userId,
          },
          {
            business_id: businessId,
            customer_id: customers![1].id,
            title: "Product consultation",
            currency: "NGN",
            total_amount_minor: 25_000_000,
            deposit_amount_minor: 10_000_000,
            status: "IN_PROGRESS",
            scheduled_for: dueToday.toISOString(),
            created_at: yesterday.toISOString(),
            started_at: now.toISOString(),
            created_by: userId,
          },
          {
            business_id: businessId,
            customer_id: customers![2].id,
            title: "Campaign delivery",
            currency: "NGN",
            total_amount_minor: 42_000_000,
            deposit_amount_minor: 12_000_000,
            status: "READY",
            scheduled_for: tomorrow.toISOString(),
            created_at: yesterday.toISOString(),
            started_at: new Date(yesterday.getTime() + 60_000).toISOString(),
            ready_at: now.toISOString(),
            created_by: userId,
          },
          {
            business_id: businessId,
            customer_id: customers![0].id,
            title: "Quarterly review",
            currency: "NGN",
            total_amount_minor: 15_000_000,
            deposit_amount_minor: 15_000_000,
            status: "COMPLETED",
            scheduled_for: yesterday.toISOString(),
            created_at: new Date(yesterday.getTime() - 86_400_000).toISOString(),
            started_at: new Date(yesterday.getTime() - 3_600_000).toISOString(),
            ready_at: new Date(yesterday.getTime() - 1_800_000).toISOString(),
            delivered_at: yesterday.toISOString(),
            completed_at: now.toISOString(),
            created_by: userId,
          },
          {
            business_id: businessId,
            customer_id: customers![1].id,
            title: "Overdue strategy session with a deliberately long title",
            currency: "NGN",
            total_amount_minor: 9_999_999_940_000,
            deposit_amount_minor: 60_000,
            status: "DRAFT",
            scheduled_for: yesterday.toISOString(),
            created_at: new Date(yesterday.getTime() - 86_400_000).toISOString(),
            created_by: userId,
          },
          ...Array.from({ length: 6 }, (_, index) => ({
            business_id: businessId,
            customer_id: customers![index % customers!.length].id,
            title: `Overdue preview ${index + 2}`,
            currency: "NGN",
            total_amount_minor: 125_000 + index,
            deposit_amount_minor: 25_000,
            status: "DRAFT",
            scheduled_for: new Date(
              yesterday.getTime() + (index + 1) * 60_000,
            ).toISOString(),
            created_at: new Date(
              yesterday.getTime() - (index + 2) * 86_400_000,
            ).toISOString(),
            created_by: userId,
          })),
        ])
        .select("id, title");
      expect(bookingError).toBeNull();
      bookingIds = bookings!.map((booking) => booking.id);
      const detailBookingId = bookings!.find(
        (booking) => booking.title === "Brand identity package",
      )!.id;

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const routes = [
        ["dashboard", "/dashboard"],
        ["bookings", "/bookings"],
        ["new-booking", "/bookings/new"],
        ["booking-detail", `/bookings/${detailBookingId}`],
        ["customers", "/customers"],
        ["new-customer", "/customers/new"],
        ["customer-detail", `/customers/${customers![0].id}`],
        ["insights", "/insights?range=last_30_days"],
        ["business", "/business"],
        ["add-business", "/business/new"],
        ["settings", "/settings#my-businesses"],
      ] as const;
      fs.mkdirSync(path.join(screenshotDirectory, "responsive"), { recursive: true });
      for (const viewport of requiredViewports) {
        const { width } = viewport;
        await page.setViewportSize(viewport);
        for (const [name, route] of routes) {
          await page.goto(route);
          await waitForRouteContent(page, route);
          if (route === "/dashboard" && width < 1024) {
            await expectAttentionSection(page, width);
          }
          if (route === "/bookings" && width < 1024) {
            await expectBookingsMobileActions(page, width);
          }
          if (route === "/bookings/new" && width < 1024) {
            await expectNewBookingPresentation(page, width);
          }
          if (route === "/customers/new" && width < 1024) {
            await expectNewCustomerPresentation(page, width);
          }
          await expectNoPageOverflow(page, route, width);
          if (route === "/business") {
            const information = page.getByRole("button", {
              name: /Business information/,
            });
            await expect(information).toHaveAttribute("aria-expanded", "false");
            await information.click();
            await expect(information).toHaveAttribute("aria-expanded", "true");
            await information.click();
            await expect(information).toHaveAttribute("aria-expanded", "false");
          }
          await hideDevelopmentChrome(page);
          await page.screenshot({
            path: path.join(screenshotDirectory, "responsive", `${name}-${width}.png`),
          });
        }
      }

      fs.mkdirSync(bookingsScreenshotDirectory, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/bookings");
      await waitForRouteContent(page, "/bookings");
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(bookingsScreenshotDirectory, "bookings-top-390.png"),
      });
      await page.evaluate(() => window.scrollTo(0, 700));
      await expect(page.locator('button[aria-label="Back to top"]')).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(page.locator('button[aria-label="Back to top"]')).toHaveCSS(
        "opacity",
        "1",
      );
      await page.screenshot({
        path: path.join(bookingsScreenshotDirectory, "bookings-scrolled-390.png"),
      });

      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/bookings");
      await waitForRouteContent(page, "/bookings");
      await hideDevelopmentChrome(page);
      await page.evaluate(() => window.scrollTo(0, 700));
      await expect(page.locator('button[aria-label="Back to top"]')).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(page.locator('button[aria-label="Back to top"]')).toHaveCSS(
        "opacity",
        "1",
      );
      await page.screenshot({
        path: path.join(bookingsScreenshotDirectory, "bookings-scrolled-320.png"),
      });

      fs.mkdirSync(newBookingScreenshotDirectory, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/bookings/new");
      await waitForRouteContent(page, "/bookings/new");
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-existing-390.png"),
      });

      await page.getByRole("button", { name: "Add new customer" }).click();
      await expect(page.getByLabel("Customer name")).toBeVisible();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-new-390.png"),
      });

      await page
        .getByRole("heading", { name: "Schedule & amounts" })
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-schedule-390.png"),
      });

      await page.getByLabel("Customer name").fill("Mobile Redesign Customer");
      await page.getByLabel("Booking title").fill("Mobile campaign delivery");
      await page.getByLabel("Description").fill("Approved responsive booking work.");
      await page.getByLabel("Scheduled delivery date").fill("2026-09-15T14:30");
      await page.getByLabel("Agreed total").fill("125000");
      await page.getByLabel("Deposit recorded").fill("25000");
      await page.getByLabel("Internal notes").fill("Visible only to this business.");
      await page
        .getByRole("button", { name: "Create booking" })
        .evaluate((element) => element.scrollIntoView({ block: "end" }));
      await page.evaluate(() => window.scrollBy(0, 88));
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-summary-390.png"),
      });

      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/bookings/new");
      await waitForRouteContent(page, "/bookings/new");
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-existing-320.png"),
      });
      await page.getByRole("button", { name: "Add new customer" }).click();
      await expect(page.getByLabel("Customer name")).toBeVisible();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(newBookingScreenshotDirectory, "new-booking-new-320.png"),
      });

      fs.mkdirSync(addCustomerScreenshotDirectory, { recursive: true });
      const addCustomerViewports = [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
      ] as const;
      for (const viewport of addCustomerViewports) {
        await page.setViewportSize(viewport);
        await page.goto("/customers/new");
        await waitForRouteContent(page, "/customers/new");
        await expectNoPageOverflow(page, "/customers/new", viewport.width);
        await hideDevelopmentChrome(page);
        const screenshotStyles = await page.addStyleTag({
          content: `
            header { position: relative !important; }
            nav[aria-label="Mobile vendor navigation"] { position: static !important; }
          `,
        });
        await page.screenshot({
          path: path.join(
            addCustomerScreenshotDirectory,
            `add-customer-empty-${viewport.width}.png`,
          ),
          fullPage: true,
        });
        await screenshotStyles.evaluate((element) =>
          element.parentNode?.removeChild(element),
        );
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/customers/new");
      await waitForRouteContent(page, "/customers/new");
      await page.getByRole("button", { name: "Create customer" }).click();
      await expect(page.getByText("Customer name is required.")).toBeVisible();
      await hideDevelopmentChrome(page);
      let screenshotStyles = await page.addStyleTag({
        content: `
          header { position: relative !important; }
          nav[aria-label="Mobile vendor navigation"] { position: static !important; }
        `,
      });
      await page.screenshot({
        path: path.join(addCustomerScreenshotDirectory, "add-customer-error-390.png"),
        fullPage: true,
      });
      await screenshotStyles.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );

      await page.getByLabel("Name", { exact: true }).fill("Responsive Customer");
      await page
        .getByLabel("Email", { exact: true })
        .fill("responsive.customer.with.a.long.address@example.com");
      await page.getByLabel("Phone", { exact: true }).fill("+353 1 555 0144");
      await page.getByLabel("Notes", { exact: true }).fill("Helpful note");
      await expect(page.getByText("12/5000", { exact: true })).toBeVisible();
      await expectNoPageOverflow(page, "/customers/new populated", 390);
      screenshotStyles = await page.addStyleTag({
        content: `
          header { position: relative !important; }
          nav[aria-label="Mobile vendor navigation"] { position: static !important; }
        `,
      });
      await page.screenshot({
        path: path.join(addCustomerScreenshotDirectory, "add-customer-populated-390.png"),
        fullPage: true,
      });
      await screenshotStyles.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );

      await page.getByRole("link", { name: "Cancel" }).click();
      await expect(page).toHaveURL(/\/customers$/);
      await page.goto("/customers/new");
      await page
        .getByRole("main")
        .getByRole("link", { name: "Customers", exact: true })
        .click();
      await expect(page).toHaveURL(/\/customers$/);

      fs.mkdirSync(screenshotDirectory, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [name, route] of routes) {
        await page.goto(route);
        await waitForRouteContent(page, route);
        await hideDevelopmentChrome(page);
        const screenshotStyles =
          route === "/dashboard"
            ? await page.addStyleTag({
                content: `
                  header { position: relative !important; }
                  nav[aria-label="Mobile vendor navigation"] { position: static !important; }
                `,
              })
            : null;
        await page.screenshot({
          path: path.join(screenshotDirectory, `${name}-390.png`),
          fullPage: true,
        });
        if (screenshotStyles) {
          await screenshotStyles.evaluate((element) =>
            element.parentNode?.removeChild(element),
          );
        }
      }

      await page.setViewportSize({ width: 390, height: 960 });
      await page.goto("/business");
      await waitForRouteContent(page, "/business");
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, "business-390.png"),
      });

      await page.setViewportSize({ width: 320, height: 1050 });
      await page.goto("/business");
      await waitForRouteContent(page, "/business");
      await hideDevelopmentChrome(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, "business-320.png"),
      });

      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/settings#my-businesses");
      await expect(
        page.getByRole("list", { name: "Active business memberships" }),
      ).toBeVisible();
      const addBusinessLink = page.getByRole("link", { name: "Add another business" });
      await expect(addBusinessLink).toHaveAttribute("href", "/business/new");
      await addBusinessLink.scrollIntoViewIfNeeded();
      await expect(addBusinessLink).toBeVisible();

      await page.goto("/business");
      await page.getByRole("button", { name: /Business information/ }).click();
      await expect(
        page.getByRole("region", { name: "Business logo settings" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Contact information/ }).click();
      await expect(page.getByLabel("Website")).toBeVisible();
      await page.getByRole("button", { name: /Business address/ }).click();
      await expect(page.getByLabel("Address")).toBeVisible();
      fs.mkdirSync(alignmentScreenshotDirectory, { recursive: true });
      await page.setViewportSize({ width: 390, height: 1200 });

      await page.goto("/dashboard");
      await waitForRouteContent(page, "/dashboard");
      await hideDevelopmentChrome(page);
      const dashboardRequestCount = await page.evaluate(
        () =>
          performance
            .getEntriesByType("resource")
            .filter((entry) => entry.name.includes("/dashboard")).length,
      );
      await page.waitForTimeout(2_000);
      await expect(page.locator("[data-pwa-reliability-status]")).toHaveCount(0);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => entry.name.includes("/dashboard")).length,
        ),
      ).toBe(dashboardRequestCount);
      await page.screenshot({
        path: path.join(alignmentScreenshotDirectory, "dashboard-stable-390.png"),
      });

      await page.goto("/bookings");
      await waitForRouteContent(page, "/bookings");
      await hideDevelopmentChrome(page);
      await expectPrimaryControlContrast(page, "New booking");
      const visibleStatusLabels = [
        "Overdue",
        "In progress",
        "Ready for delivery",
        "Completed",
      ];
      const statusBackgrounds: string[] = [];
      for (const label of visibleStatusLabels) {
        const status = page
          .locator("span.inline-flex.w-fit")
          .filter({ hasText: new RegExp(`^${label}$`) })
          .first();
        await expect(status).toBeVisible();
        statusBackgrounds.push(
          await status.evaluate((element) => getComputedStyle(element).backgroundColor),
        );
      }
      expect(new Set(statusBackgrounds).size).toBe(visibleStatusLabels.length);
      await page.screenshot({
        path: path.join(
          alignmentScreenshotDirectory,
          "bookings-statuses-new-booking-390.png",
        ),
      });

      await page.goto("/customers");
      await waitForRouteContent(page, "/customers");
      await hideDevelopmentChrome(page);
      await expectPrimaryControlContrast(page, "Add customer");
      await page.screenshot({
        path: path.join(alignmentScreenshotDirectory, "customers-cta-390.png"),
      });

      await page.goto("/business");
      await waitForRouteContent(page, "/business");
      await hideDevelopmentChrome(page);
      const businessInformation = page.getByRole("button", {
        name: /Business information/,
      });
      await expect(businessInformation).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({
        path: path.join(alignmentScreenshotDirectory, "business-collapsed-390.png"),
      });
      await businessInformation.click();
      await expect(businessInformation).toHaveAttribute("aria-expanded", "true");
      await page.setViewportSize({ width: 390, height: 1600 });
      await page.screenshot({
        path: path.join(alignmentScreenshotDirectory, "business-expanded-390.png"),
      });
      await businessInformation.click();
      await expect(businessInformation).toHaveAttribute("aria-expanded", "false");

      await page.goto(`/bookings/${detailBookingId}`);
      await waitForRouteContent(page, `/bookings/${detailBookingId}`);
      await hideDevelopmentChrome(page);
      const bookingDetailsTrigger = page.locator("#booking-details > h2 > button");
      if ((await bookingDetailsTrigger.getAttribute("aria-expanded")) !== "true") {
        await bookingDetailsTrigger.click();
      }
      await expect(bookingDetailsTrigger).toHaveAttribute("aria-expanded", "true");
      await page.screenshot({
        path: path.join(screenshotDirectory, "booking-detail-expanded-390.png"),
        fullPage: true,
      });

      const mobileNavigation = page.getByRole("navigation", {
        name: "Mobile vendor navigation",
      });
      await expect(mobileNavigation.getByRole("link")).toHaveCount(5);
      expect(
        await page.locator("main").evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(390);
    } finally {
      if (bookingIds.length > 0) {
        await admin.from("booking_status_history").delete().in("booking_id", bookingIds);
        await admin.from("booking_changes").delete().in("booking_id", bookingIds);
        await admin.from("bookings").delete().in("id", bookingIds);
      }
      if (businessId) {
        await admin.from("customers").delete().eq("business_id", businessId);
        await admin.from("audit_logs").delete().eq("business_id", businessId);
        await admin.from("business_members").delete().eq("business_id", businessId);
        await admin.from("businesses").delete().eq("id", businessId);
      }
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
