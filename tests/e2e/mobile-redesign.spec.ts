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
    if (separator > 0) process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
  }
}

loadLocalEnv();

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const requiredWidths = [320, 360, 375, 390, 430];
const screenshotDirectory = path.resolve("test-results/mobile-redesign");
const alignmentScreenshotDirectory = path.resolve("test-results/mobile-alignment");

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
  await expect(
    page.getByRole("button", { name: /^Switch business\. Current business:/ }),
  ).toBeVisible();

  if (route === "/dashboard") {
    await expect(page.getByLabel("Business summary")).toBeVisible();
    await expect(page.getByText("Product consultation", { exact: true }).first()).toBeVisible();
    return;
  }
  if (route === "/bookings") {
    await expect(page.getByLabel("Search bookings")).toBeVisible();
    await expect(page.getByText("Brand identity package", { exact: true })).toBeVisible();
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
  if (route.startsWith("/insights")) {
    await expect(page.getByLabel("Range")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customer activity" })).toBeVisible();
    return;
  }
  if (route === "/business") {
    await expect(page.getByRole("heading", { name: "Business", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current business" })).toBeVisible();
    return;
  }
  if (route === "/business/new") {
    await expect(page.getByLabel("Business name")).toBeVisible();
  }
}

async function hideDevelopmentChrome(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
}

async function expectPrimaryControlContrast(page: Page, name: string) {
  const control = page.getByRole("link", { name, exact: true });
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
    test.skip(testInfo.project.name !== "chromium", "One controlled visual matrix is sufficient.");
    test.setTimeout(120_000);

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
      dueToday.setHours(16, 30, 0, 0);
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
        ])
        .select("id, title");
      expect(bookingError).toBeNull();
      bookingIds = bookings!.map((booking) => booking.id);
      const detailBookingId = bookings!.find(
        (booking) => booking.title === "Brand identity package",
      )!.id;

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const routes = [
        ["dashboard", "/dashboard"],
        ["bookings", "/bookings"],
        ["booking-detail", `/bookings/${detailBookingId}`],
        ["customers", "/customers"],
        ["insights", "/insights?range=this_month"],
        ["business", "/business"],
        ["add-business", "/business/new"],
      ] as const;
      fs.mkdirSync(path.join(screenshotDirectory, "responsive"), { recursive: true });
      for (const width of requiredWidths) {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, route] of routes) {
          await page.goto(route);
          await waitForRouteContent(page, route);
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

      fs.mkdirSync(screenshotDirectory, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [name, route] of routes) {
        await page.goto(route);
        await waitForRouteContent(page, route);
        await hideDevelopmentChrome(page);
        await page.screenshot({
          path: path.join(screenshotDirectory, `${name}-390.png`),
          fullPage: true,
        });
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
      await page.getByRole("button", { name: "Switch business", exact: true }).click();
      await expect(
        page.getByRole("list", { name: "Active business memberships" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Business information/ }).click();
      await expect(
        page.getByRole("region", { name: "Business logo settings" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Contact information/ }).click();
      await expect(page.getByLabel("Website")).toBeVisible();
      await page.getByRole("button", { name: /Business address/ }).click();
      await expect(page.getByLabel("Address")).toBeVisible();
      const addBusinessLink = page.getByRole("link", { name: "Add another business" });
      await expect(addBusinessLink).toHaveAttribute("href", "/business/new");
      await addBusinessLink.scrollIntoViewIfNeeded();
      await expect(addBusinessLink).toBeVisible();

      const [addBusinessBox, mobileNavigationBox] = await Promise.all([
        addBusinessLink.boundingBox(),
        page
          .getByRole("navigation", { name: "Mobile vendor navigation" })
          .boundingBox(),
      ]);
      expect(addBusinessBox).not.toBeNull();
      expect(mobileNavigationBox).not.toBeNull();
      expect(addBusinessBox!.y + addBusinessBox!.height).toBeLessThanOrEqual(
        mobileNavigationBox!.y,
      );

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
      await expect(page.locator('[data-pwa-reliability-status]')).toHaveCount(0);
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
      await expectPrimaryControlContrast(page, "Add another business");
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
      expect(await page.locator("main").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
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
