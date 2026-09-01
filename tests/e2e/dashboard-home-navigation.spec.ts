import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator > 0) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

loadLocalEnv();

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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
        storageKey: `dashboard-home-navigation-${randomUUID()}`,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
      },
    },
  );
}

async function hideDevelopmentChrome(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
  });
}

test.describe("Dashboard Home navigation lifecycle", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("a dashboard card cannot resurrect a completed Home pending state", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);

    const admin = adminClient();
    const fixture = randomUUID().slice(0, 8);
    const email = `dashboard-home-navigation-${Date.now()}-${fixture}@example.com`;
    const password = `Dashboard-Home-${randomUUID()}-A1`;
    let userId: string | null = null;
    let businessId: string | null = null;
    let customerId: string | null = null;
    let bookingId: string | null = null;

    try {
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Navigation Hotfix Owner" },
      });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const { data: business, error: businessError } = await admin
        .from("businesses")
        .insert({
          name: "Navigation Hotfix Business",
          slug: `navigation-hotfix-${fixture}`,
          category: "Other",
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

      const { data: customer, error: customerError } = await admin
        .from("customers")
        .insert({
          business_id: businessId,
          name: "Navigation Hotfix Customer",
          email: "navigation-hotfix-customer@example.com",
        })
        .select("id")
        .single();
      expect(customerError).toBeNull();
      customerId = customer!.id;

      const now = new Date();
      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title: "Navigation Hotfix Booking",
          currency: "NGN",
          total_amount_minor: 100_000,
          deposit_amount_minor: 25_000,
          status: "IN_PROGRESS",
          scheduled_for: new Date(now.getTime() + 86_400_000).toISOString(),
          created_at: now.toISOString(),
          started_at: now.toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(bookingError).toBeNull();
      bookingId = booking!.id;

      const mobileProject = testInfo.project.name.includes("mobile");

      await page.setViewportSize(
        mobileProject
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
      );
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);

      const navigation = page.getByRole("navigation", {
        name:
          mobileProject
            ? "Mobile vendor navigation"
            : "Vendor navigation",
      });

      async function returnHome(destination: string) {
        const home = navigation.getByRole("link", { name: "Home" });
        await expect(home.locator('[aria-busy="true"]')).toHaveCount(0);
        await hideDevelopmentChrome(page);
        const homeClickAt = Date.now();
        await home.click();
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByLabel("Business summary")).toBeVisible();
        console.log(
          `[dashboard-home-navigation-after] ${testInfo.project.name} ${destination}: Dashboard interactive in ${Date.now() - homeClickAt}ms`,
        );
      }

      await navigation.getByRole("link", { name: "Bookings" }).click();
      await expect(page).toHaveURL(/\/bookings$/);
      await expect(page.getByLabel("Search bookings")).toBeVisible();
      const initialHome = navigation.getByRole("link", { name: "Home" });
      await hideDevelopmentChrome(page);
      await initialHome.click({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/dashboard$/);

      await page.getByRole("link", { name: "View active bookings" }).click();
      await expect(page).toHaveURL(/\/bookings\?filter=active$/);
      await returnHome("bookings-list");

      await page
        .getByRole("link", { name: /Navigation Hotfix Booking/ })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}$`));
      await returnHome("booking-detail");

      await page.getByRole("link", { name: "View customer records" }).click();
      await expect(page).toHaveURL(/\/customers$/);
      await returnHome("customers-list");

      await page.getByRole("link", { name: "View customer records" }).click();
      await expect(page).toHaveURL(/\/customers$/);
      await expect(page.getByLabel("Search customers")).toBeVisible();
      await page
        .getByRole("link", { name: /Navigation Hotfix Customer/ })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/customers/${customerId}$`));
      await returnHome("customer-detail");

      await page.getByRole("link", { name: "View insights" }).click();
      await expect(page).toHaveURL(/\/insights\?range=this_month$/);
      await returnHome("insights");

      await page.getByRole("link", { name: "Open business profile" }).click();
      await expect(page).toHaveURL(/\/business$/);
      await returnHome("business");

      await navigation.getByRole("link", { name: "Customers" }).click();
      await expect(page).toHaveURL(/\/customers$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      if (testInfo.project.name === "chromium") {
        for (const width of [390, 768, 1024, 1440]) {
          await page.setViewportSize({
            width,
            height: width < 1024 ? 844 : 1000,
          });
          await page.goto("/dashboard");
          const responsiveNavigation = page.getByRole("navigation", {
            name: width < 1024 ? "Mobile vendor navigation" : "Vendor navigation",
          });
          await expect(
            responsiveNavigation.getByRole("link", { name: "Home" }),
          ).toBeVisible();
          await expect(responsiveNavigation.locator('[aria-busy="true"]')).toHaveCount(
            0,
          );
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth + 1,
            ),
            `Dashboard navigation overflowed at ${width}px`,
          ).toBe(true);
        }
      }
    } finally {
      const cleanupFailures: string[] = [];

      if (businessId) {
        if (bookingId) {
          const history = await admin
            .from("booking_status_history")
            .delete()
            .eq("booking_id", bookingId);
          if (history.error) {
            cleanupFailures.push(`booking history: ${history.error.message}`);
          }
          const booking = await admin.from("bookings").delete().eq("id", bookingId);
          if (booking.error) cleanupFailures.push(`booking: ${booking.error.message}`);
        }
        if (customerId) {
          const customer = await admin
            .from("customers")
            .delete()
            .eq("id", customerId);
          if (customer.error) {
            cleanupFailures.push(`customer: ${customer.error.message}`);
          }
        }
        for (const table of ["audit_logs", "business_members"] as const) {
          const result = await admin
            .from(table)
            .delete()
            .eq("business_id", businessId);
          if (result.error) {
            cleanupFailures.push(`${table}: ${result.error.message}`);
          }
        }
        const business = await admin.from("businesses").delete().eq("id", businessId);
        if (business.error) {
          cleanupFailures.push(`business: ${business.error.message}`);
        }
      }
      if (userId) {
        const user = await admin.auth.admin.deleteUser(userId);
        if (user.error) cleanupFailures.push(`Auth user: ${user.error.message}`);
      }
      if (cleanupFailures.length > 0) {
        throw new Error(`Navigation fixture cleanup failed: ${cleanupFailures.join("; ")}`);
      }
    }
  });
});
