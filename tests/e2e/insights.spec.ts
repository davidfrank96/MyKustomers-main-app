import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hashFeedbackToken } from "../../features/feedback/token";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) {
    return;
  }

  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    process.env[key] ??= value;
  }
}

loadLocalEnv();

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const createdEmails = new Set<string>();
const createdBusinessSlugs = new Set<string>();

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase9-e2e-admin-${randomUUID()}`,
      },
    },
  );
}

function createAppClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase9-e2e-app-${randomUUID()}`,
      },
    },
  );
}

function testEmail(projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `phase9-e2e-insights-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
  createdEmails.add(email);
  return email;
}

async function seedInsightsBusiness({
  email,
  password,
  slug,
}: {
  email: string;
  password: string;
  slug: string;
}) {
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Phase 9 E2E Owner",
    },
  });

  expect(userError).toBeNull();
  expect(userData.user?.id).toBeTruthy();

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .insert({
      name: "Phase 9 E2E Business",
      slug,
      category: "Other",
      onboarding_completed_at: new Date().toISOString(),
      created_by: userData.user!.id,
    })
    .select("id")
    .single();

  expect(businessError).toBeNull();
  expect(business?.id).toBeTruthy();

  const { error: membershipError } = await admin.from("business_members").insert({
    business_id: business!.id,
    user_id: userData.user!.id,
    role: "owner",
    status: "active",
  });
  expect(membershipError).toBeNull();

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      business_id: business!.id,
      name: "Phase 9 Insight Customer",
      email: "phase9-insight-customer@example.com",
      phone: "+353 01 555 0199",
    })
    .select("id")
    .single();
  expect(customerError).toBeNull();

  const { data: completed, error: completedError } = await admin
    .from("bookings")
    .insert({
      business_id: business!.id,
      customer_id: customer!.id,
      title: "Phase 9 Completed Insight",
      description: "Analytics fixture",
      currency: "NGN",
      total_amount_minor: 1_000_000_428_000_000,
      deposit_amount_minor: 20_000,
      status: "COMPLETED",
      scheduled_for: "2026-08-10T10:00:00.000Z",
      started_at: "2026-08-10T08:00:00.000Z",
      ready_at: "2026-08-10T08:30:00.000Z",
      delivered_at: "2026-08-10T09:00:00.000Z",
      completed_at: "2026-08-10T10:00:00.000Z",
      created_by: userData.user!.id,
      created_at: "2026-08-01T09:00:00.000Z",
    })
    .select("id")
    .single();
  expect(completedError).toBeNull();

  const { data: eurCompleted, error: eurError } = await admin
    .from("bookings")
    .insert({
      business_id: business!.id,
      customer_id: customer!.id,
      title: "Phase 9 EUR Insight",
      description: "Analytics fixture",
      currency: "EUR",
      total_amount_minor: 85_000,
      deposit_amount_minor: 0,
      status: "COMPLETED",
      scheduled_for: "2026-08-11T10:00:00.000Z",
      started_at: "2026-08-11T08:00:00.000Z",
      ready_at: "2026-08-11T08:30:00.000Z",
      delivered_at: "2026-08-11T09:00:00.000Z",
      completed_at: "2026-08-11T10:00:00.000Z",
      created_by: userData.user!.id,
      created_at: "2026-08-02T09:00:00.000Z",
    })
    .select("id")
    .single();
  expect(eurError).toBeNull();
  expect(eurCompleted?.id).toBeTruthy();

  const { error: otherBusinessError } = await admin.from("businesses").insert({
    name: "Phase 9 Hidden Business",
    slug: `${slug}-hidden`,
    category: "Other",
    onboarding_completed_at: new Date().toISOString(),
    created_by: userData.user!.id,
  });
  expect(otherBusinessError).toBeNull();
  createdBusinessSlugs.add(`${slug}-hidden`);

  const { data: feedbackLink, error: feedbackLinkError } = await admin
    .from("feedback_links")
    .insert({
      business_id: business!.id,
      booking_id: completed!.id,
      token_hash: hashFeedbackToken(`phase9-e2e-${randomUUID()}`),
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      created_by: userData.user!.id,
    })
    .select("id")
    .single();
  expect(feedbackLinkError).toBeNull();

  const { error: feedbackError } = await admin.from("feedback").insert({
    business_id: business!.id,
    booking_id: completed!.id,
    customer_id: customer!.id,
    feedback_link_id: feedbackLink!.id,
    overall_rating: 5,
    on_time: true,
    met_expectations: true,
    comment: "Private analytics feedback",
  });
  expect(feedbackError).toBeNull();

  const appClient = createAppClient();
  const { error: signInError } = await appClient.auth.signInWithPassword({
    email,
    password,
  });
  expect(signInError).toBeNull();
  const { error: issueError } = await appClient.from("booking_issues").insert({
    business_id: business!.id,
    booking_id: completed!.id,
    category: "LATE_DELIVERY",
    description: "Analytics issue fixture",
    created_by: userData.user!.id,
  });
  expect(issueError).toBeNull();
}

test.describe("business insights", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test.afterAll(async () => {
    const admin = createAdminClient();

    if (createdBusinessSlugs.size > 0) {
      const { data: businesses } = await admin
        .from("businesses")
        .select("id")
        .in("slug", [...createdBusinessSlugs]);
      const businessIds = businesses?.map((business) => business.id) ?? [];

      if (businessIds.length > 0) {
        const { data: bookings } = await admin
          .from("bookings")
          .select("id")
          .in("business_id", businessIds);
        const bookingIds = bookings?.map((booking) => booking.id) ?? [];

        if (bookingIds.length > 0) {
          await admin.from("booking_issues").delete().in("booking_id", bookingIds);
          await admin.from("feedback").delete().in("booking_id", bookingIds);
          await admin.from("feedback_links").delete().in("booking_id", bookingIds);
          await admin
            .from("booking_status_history")
            .delete()
            .in("booking_id", bookingIds);
          await admin.from("booking_changes").delete().in("booking_id", bookingIds);
        }

        await admin.from("bookings").delete().in("business_id", businessIds);
        await admin.from("customers").delete().in("business_id", businessIds);
        await admin.from("audit_logs").delete().in("business_id", businessIds);
        await admin.from("business_members").delete().in("business_id", businessIds);
        await admin.from("businesses").delete().in("id", businessIds);
      }
    }

    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const usersToDelete = data?.users.filter((user) =>
      user.email ? createdEmails.has(user.email) : false,
    );

    await Promise.allSettled(
      (usersToDelete ?? []).map((user) => admin.auth.admin.deleteUser(user.id)),
    );
  });

  test("authenticated business member can view tenant analytics", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The explicit responsive matrix runs once.",
    );

    const email = testEmail(testInfo.project.name);
    const password = `Phase9-E2E-${randomUUID()}-A1`;
    const slug = `phase9-e2e-insights-${Date.now()}-${randomUUID().slice(0, 8)}`;
    createdBusinessSlugs.add(slug);

    await seedInsightsBusiness({ email, password, slug });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/insights?range=last_30_days");
    await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    await expect(
      page.getByText("Private metrics calculated from saved business records."),
    ).toBeVisible();
    const completedBookingsCard = page
      .getByRole("heading", { name: "Completed bookings" })
      .locator("..")
      .locator("..");
    await expect(completedBookingsCard.getByText("2", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recorded booking value" }),
    ).toBeVisible();
    const largeNgnValue = page.getByText("₦10,000,004,280,000").first();
    await expect(largeNgnValue).toBeVisible();
    await expect(page.getByText("NGN", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("EUR", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("GBP", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Average rating" })).toBeVisible();
    await expect(page.getByText("5.0")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Issue categories" })).toBeVisible();
    await expect(page.getByText("Late delivery")).toBeVisible();
    await expect(page.getByText("Phase 9 Hidden Business")).toHaveCount(0);

    const outputDirectory = "output/playwright/insights-redesign";
    fs.mkdirSync(outputDirectory, { recursive: true });
    const viewportMatrix = [
      { width: 320, height: 568 },
      { width: 360, height: 800 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];
    const screenshotWidths = new Set([320, 360, 390, 430, 768, 1024, 1440]);
    const customerScroller = page.locator('[data-insights-scroller="customer-activity"]');

    for (const viewport of viewportMatrix) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));

      const documentDimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(documentDimensions.scrollWidth).toBeLessThanOrEqual(
        documentDimensions.clientWidth + 1,
      );

      const scrollerDimensions = await customerScroller.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      if (viewport.width < 640) {
        expect(scrollerDimensions.scrollWidth).toBeGreaterThan(
          scrollerDimensions.clientWidth,
        );
        const scrollerBox = await customerScroller.boundingBox();
        const secondCardBox = await customerScroller
          .locator("[data-insights-metric]")
          .nth(1)
          .boundingBox();
        expect(scrollerBox).not.toBeNull();
        expect(secondCardBox).not.toBeNull();
        expect(secondCardBox!.x).toBeLessThan(scrollerBox!.x + scrollerBox!.width);
        expect(secondCardBox!.x + secondCardBox!.width).toBeGreaterThan(
          scrollerBox!.x + scrollerBox!.width,
        );
      } else {
        expect(scrollerDimensions.scrollWidth).toBeLessThanOrEqual(
          scrollerDimensions.clientWidth + 1,
        );
      }

      const largeValueFits = await largeNgnValue.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      );
      expect(largeValueFits).toBe(true);

      if (viewport.width < 1024) {
        const mobileNavigation = page.getByRole("navigation", {
          name: "Mobile vendor navigation",
        });
        await expect(mobileNavigation).toBeVisible();
        await expect(
          mobileNavigation.getByRole("link", { name: "Insights" }),
        ).toBeVisible();
      }

      if (screenshotWidths.has(viewport.width)) {
        await page.evaluate(() => {
          document
            .querySelectorAll("nextjs-portal")
            .forEach((element) => element.remove());
        });
        await page.screenshot({
          path: `${outputDirectory}/insights-${viewport.width}.png`,
        });
        if (viewport.width === 390) {
          await page.screenshot({
            path: `${outputDirectory}/insights-top-390.png`,
          });
        }
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const sectionScreenshots = [
      {
        name: "customer-activity",
        locator: page.locator('[data-insights-scroller="customer-activity"]'),
      },
      {
        name: "bookings-value",
        locator: page.locator('[data-insights-scroller="bookings-value"]'),
      },
      { name: "booking-trend", locator: page.locator("[data-booking-trend]") },
      {
        name: "operations",
        locator: page
          .getByRole("heading", { name: "Operations", exact: true })
          .locator(".."),
      },
      {
        name: "feedback",
        locator: page
          .getByRole("heading", { name: "Feedback", exact: true })
          .locator(".."),
      },
      {
        name: "issues",
        locator: page.getByRole("heading", { name: "Issues", exact: true }).locator(".."),
      },
    ];
    const sectionScreenshotStyles = await page.addStyleTag({
      content: `nav[aria-label="Mobile vendor navigation"] { display: none !important; }`,
    });
    for (const screenshot of sectionScreenshots) {
      await screenshot.locator.screenshot({
        path: `${outputDirectory}/${screenshot.name}-390.png`,
      });
    }
    await sectionScreenshotStyles.evaluate((element) =>
      element.parentNode?.removeChild(element),
    );

    await page
      .getByRole("heading", { name: "Bookings & value", exact: true })
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `${outputDirectory}/insights-middle-390.png`,
    });
    await page
      .getByRole("heading", { name: "Issues", exact: true })
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: `${outputDirectory}/insights-bottom-390.png`,
    });
    await page.evaluate(() => window.scrollTo(0, 0));

    for (const preset of [
      { label: "7D", value: "last_7_days" },
      { label: "30D", value: "last_30_days" },
      { label: "3M", value: "last_3_months" },
      { label: "6M", value: "last_6_months" },
    ]) {
      await page.getByRole("link", { name: preset.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`range=${preset.value}`));
      await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Custom" }).click();
    await expect(page.getByLabel("From", { exact: true })).toBeVisible();
    await expect(page.getByLabel("To", { exact: true })).toBeVisible();
    await page.locator("[data-insights-custom-range]").screenshot({
      path: `${outputDirectory}/custom-range-expanded-390.png`,
    });
    await page.getByLabel("From", { exact: true }).fill("2026-08-01");
    await page.getByLabel("To", { exact: true }).fill("2026-08-31");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/range=custom/);
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/to=2026-08-31/);
    await expect(largeNgnValue).toBeVisible();

    await page.getByRole("link", { name: "30D", exact: true }).click();
    await expect(page).toHaveURL(/range=last_30_days/);
    await expect(page.getByLabel("From", { exact: true })).toHaveCount(0);
  });
});
