import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route as PlaywrightRoute } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { hashRateLimitIdentity } from "../../features/confirmation-links/rate-limit-keys";
import { hashConfirmationToken } from "../../features/confirmation-links/token";
import { hashAddonToken } from "../../features/addons/token";
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

const createdUserIds = new Set<string>();
const createdBusinessSlugs = new Set<string>();
const createdRateLimitBuckets = new Set<string>();
const serverActionTimeout = 15_000;

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase5-e2e-admin-${randomUUID()}`,
      },
    },
  );
}

async function resetLocalRateLimitBuckets(
  admin: ReturnType<typeof createAdminClient>,
  userAgent: string,
  actions: string[],
) {
  const bucketKeys = actions.flatMap((action) =>
    ["unknown", "127.0.0.1"].map((identity) =>
      hashRateLimitIdentity(`${action}:${identity}:${userAgent}`),
    ),
  );

  bucketKeys.forEach((bucketKey) => createdRateLimitBuckets.add(bucketKey));
  await admin.from("confirmation_rate_limits").delete().in("bucket_key", bucketKeys);
}

function testEmail(projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `phase5-e2e-bookings-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
}

function futureLocalDateTime() {
  const future = new Date(Date.now() + 86_400_000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function futureLocalDateTimePlus(days: number) {
  const future = new Date(Date.now() + days * 86_400_000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expandBookingSection(page: Page, sectionId: string) {
  const trigger = page.locator(`#${sectionId} > h2 > button`);
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

async function createConfirmedBusinessOwner({
  email,
  password,
  slug,
  customerName = null,
  customerEmail = null,
}: {
  email: string;
  password: string;
  slug: string;
  customerName?: string | null;
  customerEmail?: string | null;
}) {
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Phase 5 E2E Owner",
    },
  });

  expect(userError).toBeNull();
  expect(userData.user?.id).toBeTruthy();
  createdUserIds.add(userData.user!.id);

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .insert({
      name: "Phase 5 E2E Business",
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

  if (!customerName) {
    return { businessId: business!.id, customerId: null, userId: userData.user!.id };
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      business_id: business!.id,
      name: customerName,
      email: customerEmail,
      phone: null,
    })
    .select("id")
    .single();
  expect(customerError).toBeNull();
  expect(customer?.id).toBeTruthy();

  return {
    businessId: business!.id,
    customerId: customer!.id,
    userId: userData.user!.id,
  };
}

test.describe("booking engine", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test.afterAll(async () => {
    test.setTimeout(120_000);
    const admin = createAdminClient();

    if (createdRateLimitBuckets.size > 0) {
      const { error } = await admin
        .from("confirmation_rate_limits")
        .delete()
        .in("bucket_key", [...createdRateLimitBuckets]);
      expect(error).toBeNull();
    }

    if (createdBusinessSlugs.size > 0) {
      const { data: businesses, error: businessesError } = await admin
        .from("businesses")
        .select("id")
        .in("slug", [...createdBusinessSlugs]);
      expect(businessesError).toBeNull();
      const businessIds = businesses?.map((business) => business.id) ?? [];

      if (businessIds.length > 0) {
        const { error: auditLogError } = await admin
          .from("audit_logs")
          .delete()
          .in("business_id", businessIds);
        expect(auditLogError).toBeNull();

        const { error: logoError } = await admin.storage
          .from("business-logos")
          .remove(businessIds.map((businessId) => `${businessId}/logo.webp`));
        expect(logoError).toBeNull();

        const { error: businessDeleteError } = await admin
          .from("businesses")
          .delete()
          .in("id", businessIds);
        expect(businessDeleteError).toBeNull();
      }
    }

    const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    expect(authUsersError).toBeNull();
    const remainingUserIds = new Set(authUsers.users.map((user) => user.id));
    const userDeletionResults = await Promise.all(
      [...createdUserIds]
        .filter((userId) => remainingUserIds.has(userId))
        .map((userId) => admin.auth.admin.deleteUser(userId)),
    );
    for (const { error } of userDeletionResults) {
      expect(error).toBeNull();
    }
  });

  test("canonical customer, booking, confirmation, fulfilment, feedback, and insights journey", async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const rateLimitIdentity =
      testInfo.project.name === "mobile-chrome" ? "198.51.100.42" : "198.51.100.41";
    await context.setExtraHTTPHeaders({ "x-forwarded-for": rateLimitIdentity });

    const email = testEmail(testInfo.project.name);
    const password = `Phase5-E2E-${randomUUID()}-A1`;
    const slug = `phase5-e2e-bookings-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const businessName = "Phase 5 E2E Business";
    const customerName = `Phase 5 Customer ${randomUUID().slice(0, 8)}`;
    const bookingTitle = `Phase 5 Booking ${randomUUID().slice(0, 8)}`;
    const updatedTitle = `${bookingTitle} Updated`;
    const amendedTitle = `${updatedTitle} Amended`;
    createdBusinessSlugs.add(slug);

    const ownerFixture = await createConfirmedBusinessOwner({
      email,
      password,
      slug,
    });
    const admin = createAdminClient();
    const logoPath = `${ownerFixture.businessId}/logo.webp`;
    const logo = await sharp({
      create: {
        width: 640,
        height: 320,
        channels: 4,
        background: { r: 19, g: 104, b: 84, alpha: 1 },
      },
    })
      .webp({ quality: 80 })
      .toBuffer();
    const { error: logoUploadError } = await admin.storage
      .from("business-logos")
      .upload(logoPath, logo, { contentType: "image/webp", upsert: true });
    expect(logoUploadError).toBeNull();
    const { error: identityUpdateError } = await admin
      .from("businesses")
      .update({
        logo_path: logoPath,
        website: "https://phase5.example.com/booking",
        instagram: "phase5business",
      })
      .eq("id", ownerFixture.businessId);
    expect(identityUpdateError).toBeNull();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/customers/new");
    await expect(page.getByRole("heading", { name: "Add customer" })).toBeVisible();
    await page.getByLabel("Name").fill(customerName);
    await page.getByLabel("Notes").fill("Created during the canonical product journey.");
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\?created=1/);
    await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
    const customerId = new URL(page.url()).pathname.split("/").at(-1);
    expect(customerId).toBeTruthy();
    const fixture = { businessId: ownerFixture.businessId, customerId: customerId! };

    await page.goto("/bookings");
    await expect(
      page.getByRole("heading", { name: "Bookings", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "New booking" }).first().click();
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();

    await page.locator("#customerId").click();
    await page.locator('[role="option"]').filter({ hasText: customerName }).click();
    await expect(page.getByLabel("Scheduled delivery date")).toBeVisible();
    await expect(page.getByLabel("Agreed total")).toHaveValue("");
    await expect(page.getByLabel("Deposit recorded")).toHaveValue("");
    const scheduledFor = futureLocalDateTime();
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Created through Phase 5 E2E.");
    await page.getByLabel("Scheduled delivery date").fill(scheduledFor);
    await page.getByLabel("Agreed total").fill("45000");
    await page.getByLabel("Deposit recorded").fill("5000");
    await page.getByLabel("Internal notes").fill("Private E2E note.");
    await page.getByRole("button", { name: "Create booking" }).click();

    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/, {
      timeout: 15_000,
    });
    const bookingDetailUrl = page.url();
    const bookingSyncId = new URL(bookingDetailUrl).pathname.split("/").at(-1)!;
    const bookingIdentity = page.locator("[data-booking-identity]");
    const bookingJourney = page.locator("[data-booking-journey]");
    const bookingDetailScreenshotDirectory = "test-results/booking-detail-header-journey";
    if (testInfo.project.name === "chromium") {
      fs.mkdirSync(bookingDetailScreenshotDirectory, { recursive: true });
    }
    await expect(page.getByRole("heading", { name: bookingTitle })).toBeVisible();
    const referenceTag = bookingIdentity.getByText(/MC-[0-9]{6}-[A-F0-9]{6}/);
    await expect(referenceTag).toBeVisible();
    const bookingReference = (await referenceTag.textContent()) ?? "";
    expect(bookingReference).toMatch(/^MC-[0-9]{6}-[A-F0-9]{6}$/);
    await expect(bookingIdentity.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByText("Booking created.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Booking created" })).toBeVisible();
    await expect(
      page.locator('[aria-current="step"]').getByText("Booking created"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Generate confirmation link" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Generate confirmation link" }),
    ).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);

    await expect(page.locator("#customer-confirmation > h2 > button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator("#booking-payments > h2 > button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    const operationalProgressScreenshotDirectory =
      "test-results/operational-progress-panel";
    const operationalProgressSection = page.locator("#operational-progress");
    const bookingChangesScreenshotDirectory = "test-results/booking-changes-panel";
    const bookingChangesSection = page.locator("#booking-changes");
    const bookingAddonScreenshotDirectory = "test-results/booking-addons-panel";
    const bookingAddonSection = page.locator("#booking-addons");
    const feedbackScreenshotDirectory = "test-results/private-feedback-panel";
    const publicFeedbackScreenshotDirectory = "test-results/public-private-feedback-page";
    const operationalIssuesScreenshotDirectory = "test-results/operational-issues-panel";
    const operationalTimelineScreenshotDirectory =
      "test-results/operational-timeline-panel";
    const operationalIssuesSection = page.locator("#operational-issues");
    const operationalProgressScreenshotChrome =
      testInfo.project.name === "chromium"
        ? await page.addStyleTag({
            content: `
              nextjs-portal {
                visibility: hidden !important;
              }
            `,
          })
        : null;
    if (operationalProgressScreenshotChrome) {
      fs.mkdirSync(operationalProgressScreenshotDirectory, { recursive: true });
      fs.mkdirSync(bookingChangesScreenshotDirectory, { recursive: true });
      fs.mkdirSync(bookingAddonScreenshotDirectory, { recursive: true });
      fs.mkdirSync(feedbackScreenshotDirectory, { recursive: true });
      fs.mkdirSync(publicFeedbackScreenshotDirectory, { recursive: true });
      fs.mkdirSync(operationalIssuesScreenshotDirectory, { recursive: true });
      fs.mkdirSync(operationalTimelineScreenshotDirectory, { recursive: true });
    }

    const journeyViewport = page.viewportSize();
    await expandBookingSection(page, "operational-progress");
    await expandBookingSection(page, "booking-changes");
    await expandBookingSection(page, "booking-addons");
    await expandBookingSection(page, "operational-issues");
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      await expect(
        bookingIdentity.getByText(bookingReference, { exact: true }),
      ).toBeVisible();
      await expect(bookingIdentity.getByText("Draft", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Booking created" })).toBeVisible();
      await expect(bookingJourney.getByText("Current", { exact: true })).toBeVisible();
      const visibleBusinessSwitcher = page.getByRole("button", {
        name: `Switch business. Current business: ${businessName}`,
      });
      await expect(visibleBusinessSwitcher).toBeVisible();
      await expect(
        visibleBusinessSwitcher.getByLabel(`${businessName} logo`),
      ).toBeVisible();
      await expect(
        visibleBusinessSwitcher.getByLabel(`${businessName} logo`).locator("img"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
      if (width < 1024) {
        await expect(
          page.getByRole("navigation", { name: "Mobile vendor navigation" }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("link", { name: "Generate confirmation link" }),
      ).toBeVisible();
      await expect(
        operationalProgressSection.getByRole("list", {
          name: "Booking operational progress",
        }),
      ).toBeVisible();
      await expect(
        operationalProgressSection.getByText("Not scheduled", { exact: true }),
      ).toHaveCount(5);
      await expect(
        bookingChangesSection
          .getByRole("note")
          .getByText(
            "Booking changes can be proposed only while a confirmed booking is confirmed or in progress.",
          ),
      ).toBeVisible();
      await expect(
        bookingAddonSection.getByText(
          "Add-ons are available only while a confirmed booking is confirmed or in progress.",
        ),
      ).toBeVisible();
      await expect(
        bookingAddonSection.getByRole("button", { name: "Add item" }),
      ).toBeDisabled();
      await expect(operationalIssuesSection.getByLabel("Category")).toBeVisible();
      await expect(
        operationalIssuesSection.getByLabel("Issue description"),
      ).toHaveAttribute("maxlength", "2000");
      await expect(
        operationalIssuesSection.getByRole("button", { name: "Create issue" }),
      ).toBeVisible();
      await expect(
        operationalIssuesSection.getByText("Everything looks good so far."),
      ).toBeVisible();

      for (const sectionName of [
        "Payment & completion",
        "Operational progress",
        "Customer confirmation",
        "Booking changes",
        "Booking add-ons",
        "Private feedback",
        "Operational issues",
        "Reschedule",
        "Edit booking",
        "Operational timeline",
      ]) {
        await expect(
          page.getByRole("button", { name: new RegExp(sectionName) }),
        ).toBeAttached();
      }

      if (operationalProgressScreenshotChrome && [320, 390, 768, 1024].includes(width)) {
        await operationalProgressSection.screenshot({
          path: `${operationalProgressScreenshotDirectory}/operational-progress-early-expanded-${width}.png`,
          animations: "disabled",
        });
        await bookingChangesSection.screenshot({
          path: `${bookingChangesScreenshotDirectory}/booking-changes-empty-expanded-${width}.png`,
          animations: "disabled",
        });
        if (width === 390) {
          await bookingAddonSection.screenshot({
            path: `${bookingAddonScreenshotDirectory}/booking-addons-ineligible-expanded-390.png`,
            animations: "disabled",
          });
        }
        if ([320, 390, 768, 1024].includes(width)) {
          await operationalIssuesSection.screenshot({
            path: `${operationalIssuesScreenshotDirectory}/operational-issues-empty-expanded-${width}.png`,
            animations: "disabled",
          });
        }
      }
      if (testInfo.project.name === "chromium" && [320, 768, 1024].includes(width)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${bookingDetailScreenshotDirectory}/booking-detail-created-${width}.png`,
          animations: "disabled",
        });
      }
    }

    if (operationalProgressScreenshotChrome) {
      await page.setViewportSize({ width: 390, height: 900 });
      const operationalProgressTrigger =
        operationalProgressSection.locator("h2 > button");
      await operationalProgressTrigger.click();
      await expect(operationalProgressTrigger).toHaveAttribute("aria-expanded", "false");
      await operationalProgressSection.screenshot({
        path: `${operationalProgressScreenshotDirectory}/operational-progress-collapsed-390.png`,
        animations: "disabled",
      });
      await operationalProgressTrigger.click();
      await expect(operationalProgressTrigger).toHaveAttribute("aria-expanded", "true");

      const bookingChangesTrigger = bookingChangesSection.locator("h2 > button");
      await bookingChangesTrigger.click();
      await expect(bookingChangesTrigger).toHaveAttribute("aria-expanded", "false");
      await bookingChangesSection.screenshot({
        path: `${bookingChangesScreenshotDirectory}/booking-changes-empty-collapsed-390.png`,
        animations: "disabled",
      });
      await bookingChangesTrigger.click();
      await expect(bookingChangesTrigger).toHaveAttribute("aria-expanded", "true");

      const operationalIssuesTrigger = operationalIssuesSection.locator("h2 > button");
      await operationalIssuesTrigger.click();
      await expect(operationalIssuesTrigger).toHaveAttribute("aria-expanded", "false");
      await operationalIssuesSection.screenshot({
        path: `${operationalIssuesScreenshotDirectory}/operational-issues-collapsed-390.png`,
        animations: "disabled",
      });
      await operationalIssuesTrigger.click();
      await expect(operationalIssuesTrigger).toHaveAttribute("aria-expanded", "true");
      await operationalProgressScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    if (journeyViewport) await page.setViewportSize(journeyViewport);

    const { data: storedSchedule, error: storedScheduleError } = await admin
      .from("bookings")
      .select("scheduled_for")
      .eq("id", bookingSyncId)
      .single();
    expect(storedScheduleError).toBeNull();
    const { error: overdueFixtureError } = await admin
      .from("bookings")
      .update({ scheduled_for: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", bookingSyncId);
    expect(overdueFixtureError).toBeNull();
    await page.goto(bookingDetailUrl);
    await expect(bookingIdentity.getByText("Overdue", { exact: true })).toBeVisible();
    await expect(
      bookingIdentity.getByText(bookingReference, { exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoPageOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${bookingDetailScreenshotDirectory}/booking-detail-overdue-390.png`,
        animations: "disabled",
      });
    }
    const { error: restoreScheduleError } = await admin
      .from("bookings")
      .update({ scheduled_for: storedSchedule!.scheduled_for })
      .eq("id", bookingSyncId);
    expect(restoreScheduleError).toBeNull();
    await page.goto(bookingDetailUrl);
    await expect(bookingIdentity.getByText("Draft", { exact: true })).toBeVisible();
    if (journeyViewport) await page.setViewportSize(journeyViewport);

    await expandBookingSection(page, "booking-details");
    await page.getByLabel("Booking title").fill(updatedTitle);
    await page.getByLabel("Internal notes").fill("Updated private E2E note.");
    await page.getByRole("button", { name: "Save booking" }).click();
    await expect(page.getByText("Booking updated.")).toBeVisible();
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    const syncResponse = await page.request.get(`/api/bookings/${bookingSyncId}/sync`);
    expect(syncResponse.ok()).toBe(true);
    expect(syncResponse.headers()["cache-control"]).toContain("no-store");
    expect(Object.keys(await syncResponse.json()).sort()).toEqual([
      "customerConfirmedAt",
      "feedbackSubmittedAt",
      "revision",
      "status",
    ]);
    expect((await page.request.get(`/api/bookings/${randomUUID()}/sync`)).status()).toBe(
      404,
    );
    await expect(
      page.locator("#customer-confirmation > h2").getByText("Not generated", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate confirmation link" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Share with customer" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Regenerate link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Revoke link" })).toHaveCount(0);

    if (testInfo.project.name === "chromium") {
      fs.mkdirSync("test-results/customer-confirmation-panel", { recursive: true });
      const initialConfirmationViewport = page.viewportSize();
      const initialConfirmationSection = page.locator("#customer-confirmation");
      const initialScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await initialConfirmationSection.screenshot({
        path: "test-results/customer-confirmation-panel/customer-confirmation-no-link-390.png",
      });
      await initialScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (initialConfirmationViewport) {
        await page.setViewportSize(initialConfirmationViewport);
      }
    }

    await page.getByRole("button", { name: "Generate confirmation link" }).click();
    const generatedLinkInput = page.getByLabel("Generated confirmation link");
    await expect(generatedLinkInput).toBeAttached({ timeout: 15_000 });
    let confirmationUrl = await generatedLinkInput.inputValue();
    expect(confirmationUrl).toContain("/c/");
    await expect(
      page.locator("#customer-confirmation > h2").getByText("Awaiting customer", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Awaiting customer$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Waiting for customer confirmation" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);

    if (testInfo.project.name === "chromium") {
      const confirmationScreenshotDirectory = "test-results/customer-confirmation-panel";
      fs.mkdirSync(confirmationScreenshotDirectory, { recursive: true });
      const previousViewport = page.viewportSize();
      const confirmationSection = page.locator("#customer-confirmation");
      const screenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });

      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
        await expandBookingSection(page, "customer-confirmation");
        await expectNoPageOverflow(page);
        await expect(
          confirmationSection.getByRole("button", { name: "Share with customer" }),
        ).toBeVisible();
        await expect(
          confirmationSection.getByRole("button", { name: "Regenerate link" }),
        ).toBeVisible();
        await expect(
          confirmationSection.getByRole("button", { name: "Revoke link" }),
        ).toBeVisible();

        if ([320, 390, 768, 1024].includes(width)) {
          await confirmationSection.screenshot({
            path: `${confirmationScreenshotDirectory}/customer-confirmation-expanded-${width}.png`,
          });
        }
      }

      await page.setViewportSize({ width: 390, height: 900 });
      const confirmationTrigger = confirmationSection.locator("h2 > button");
      await confirmationTrigger.click();
      await expect(confirmationTrigger).toHaveAttribute("aria-expanded", "false");
      await confirmationSection.screenshot({
        path: `${confirmationScreenshotDirectory}/customer-confirmation-collapsed-390.png`,
      });
      await confirmationTrigger.click();
      await expect(confirmationTrigger).toHaveAttribute("aria-expanded", "true");
      await screenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (previousViewport) await page.setViewportSize(previousViewport);
    }

    await page.reload();
    await expandBookingSection(page, "customer-confirmation");
    await expect(
      page.locator("#customer-confirmation > h2").getByText("Awaiting customer", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("An active confirmation link exists.")).toBeVisible();
    await expect(
      page.getByText(
        "The exact secure link is no longer available here. Regenerate it to create a fresh shareable link.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Share with customer" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Regenerate link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke link" })).toBeVisible();

    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(
      page.locator("#customer-confirmation > h2").getByText("Link revoked", {
        exact: true,
      }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(page.getByRole("button", { name: "Share with customer" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Revoke link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Regenerate link" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Generate new confirmation link" }),
    ).toBeVisible();

    if (testInfo.project.name === "chromium") {
      const revokedConfirmationViewport = page.viewportSize();
      const revokedScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.locator("#customer-confirmation").screenshot({
        path: "test-results/customer-confirmation-panel/customer-confirmation-revoked-390.png",
      });
      await revokedScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (revokedConfirmationViewport) {
        await page.setViewportSize(revokedConfirmationViewport);
      }
    }

    await page.getByRole("button", { name: "Generate new confirmation link" }).click();
    await expect(generatedLinkInput).toBeAttached({ timeout: serverActionTimeout });
    confirmationUrl = await generatedLinkInput.inputValue();
    expect(confirmationUrl).toContain("/c/");
    await expect(page.getByRole("button", { name: "Share with customer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Regenerate link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke link" })).toBeVisible();

    await page.getByRole("button", { name: "Share with customer" }).click();
    await expect(
      page.getByRole("heading", { name: "Share with customer" }),
    ).toBeVisible();
    expect(await page.getByLabel("Message").inputValue()).toContain(
      `Hi ${customerName.split(" ")[0]}, Phase 5 E2E Business`,
    );
    await expect(page.getByLabel("Confirmation link", { exact: true })).toHaveValue(
      confirmationUrl,
    );
    await page.getByLabel("Message").fill("Please review this secure order request.");
    await page.getByRole("button", { name: "Copy message" }).click();
    await expect(page.getByText("Message copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `Please review this secure order request.\n\n${confirmationUrl}`,
    );
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Link copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      confirmationUrl,
    );
    await page.getByRole("button", { name: "Close dialog" }).click();

    const previewResponse = await page.request.get(confirmationUrl, {
      headers: {
        "user-agent": `TelegramBot (trusted-sharing-e2e-${testInfo.project.name})`,
      },
    });
    expect(previewResponse.ok()).toBe(true);
    const previewHtml = await previewResponse.text();
    expect(previewHtml).toContain("Secure order confirmation");
    expect(previewHtml).toContain("Review your order with Phase 5 E2E Business");
    expect(previewHtml).not.toContain(customerName);
    expect(previewHtml).not.toContain(updatedTitle);
    expect(previewHtml).not.toContain("₦45,000");
    expect(previewHtml).not.toContain("Updated private E2E note.");
    const { data: linkAfterCrawler } = await admin
      .from("confirmation_links")
      .select("first_opened_at")
      .eq(
        "token_hash",
        hashConfirmationToken(new URL(confirmationUrl).pathname.split("/").at(-1) ?? ""),
      )
      .single();
    expect(linkAfterCrawler?.first_opened_at).toBeNull();

    const userAgent = (await page.evaluate(() => navigator.userAgent)).slice(0, 80);
    createdRateLimitBuckets.add(hashRateLimitIdentity(`lookup:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`metadata:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`confirm:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`open:unknown:${userAgent}`));
    createdRateLimitBuckets.add(
      hashRateLimitIdentity(`feedback_lookup:unknown:${userAgent}`),
    );
    createdRateLimitBuckets.add(
      hashRateLimitIdentity(`feedback_submit:unknown:${userAgent}`),
    );
    createdRateLimitBuckets.add(
      hashRateLimitIdentity(`feedback_metadata:unknown:${userAgent}`),
    );
    createdRateLimitBuckets.add(
      hashRateLimitIdentity(`feedback_open:unknown:${userAgent}`),
    );
    for (const action of [
      "addon_lookup",
      "addon_metadata",
      "addon_confirm",
      "addon_open",
    ]) {
      createdRateLimitBuckets.add(
        hashRateLimitIdentity(`${action}:unknown:${userAgent}`),
      );
    }
    for (const action of [
      "lookup",
      "metadata",
      "confirm",
      "open",
      "feedback_lookup",
      "feedback_submit",
      "feedback_metadata",
      "feedback_open",
      "addon_lookup",
      "addon_metadata",
      "addon_confirm",
      "addon_open",
    ]) {
      createdRateLimitBuckets.add(
        hashRateLimitIdentity(`${action}:127.0.0.1:${userAgent}`),
      );
      createdRateLimitBuckets.add(
        hashRateLimitIdentity(`${action}:${rateLimitIdentity}:${userAgent}`),
      );
    }
    await admin
      .from("confirmation_rate_limits")
      .delete()
      .in("bucket_key", [...createdRateLimitBuckets]);

    const customerPage = await context.newPage();
    await customerPage.goto(confirmationUrl);
    await expect(
      customerPage.getByRole("heading", { name: "Review your order" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("confirmation_links")
          .select("first_opened_at")
          .eq(
            "token_hash",
            hashConfirmationToken(
              new URL(confirmationUrl).pathname.split("/").at(-1) ?? "",
            ),
          )
          .single();
        return Boolean(data?.first_opened_at);
      })
      .toBe(true);
    await expect(customerPage.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Review your order with Phase 5 E2E Business",
    );
    await expect(customerPage.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "Phase 5 E2E Business has sent you an order for review and confirmation.",
    );
    await expect(customerPage.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      confirmationUrl,
    );
    await expect(customerPage.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "website",
    );
    await expect(customerPage.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "My Kustomers",
    );
    await expect(customerPage.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /business-logos/,
    );
    await expect(
      customerPage.getByText("Phase 5 E2E Business", { exact: true }),
    ).toBeVisible();
    await expect(
      customerPage.getByLabel("Phase 5 E2E Business logo").locator("img"),
    ).toBeVisible();
    await expect(
      customerPage.getByRole("link", {
        name: "Visit Phase 5 E2E Business website",
      }),
    ).toHaveAttribute("href", "https://phase5.example.com/booking");
    await expect(
      customerPage.getByRole("link", {
        name: "Visit Phase 5 E2E Business on Instagram",
      }),
    ).toHaveAttribute("href", "https://www.instagram.com/phase5business/");
    await expect(customerPage.getByText(ownerFixture.businessId)).toHaveCount(0);
    await expect(customerPage.getByText(updatedTitle)).toBeVisible();
    await expect(customerPage.getByText("₦45,000")).toBeVisible();
    await expect(customerPage.getByText("Updated private E2E note.")).toHaveCount(0);
    await expect(customerPage.getByText("Scheduled delivery")).toBeVisible();
    await expect(customerPage.getByText("Powered by MyKustomers.com")).toBeVisible();
    await expect(
      customerPage.getByRole("link", { name: "Learn more about My Kustomers" }),
    ).toHaveAttribute("href", "https://mykustomers.com");

    const customerConfirmationViewport = customerPage.viewportSize();
    if (testInfo.project.name === "chromium") {
      const publicConfirmationScreenshotDirectory =
        "test-results/public-booking-confirmation";
      fs.mkdirSync(publicConfirmationScreenshotDirectory, { recursive: true });
      await customerPage.addStyleTag({
        content: "nextjs-portal { visibility: hidden !important; }",
      });

      for (const width of [320, 390, 430, 768, 1024]) {
        await customerPage.setViewportSize({
          width,
          height: width < 768 ? 900 : 1000,
        });
        await expectNoPageOverflow(customerPage);
        await customerPage.screenshot({
          path: `${publicConfirmationScreenshotDirectory}/ready-with-links-${width}.png`,
          fullPage: true,
        });
      }

      const { error: linksRemovedError } = await admin
        .from("businesses")
        .update({ website: null, instagram: null })
        .eq("id", ownerFixture.businessId);
      expect(linksRemovedError).toBeNull();
      await customerPage.reload();
      await customerPage.setViewportSize({ width: 390, height: 900 });
      await customerPage.addStyleTag({
        content: "nextjs-portal { visibility: hidden !important; }",
      });
      await expect(
        customerPage.getByRole("heading", { name: "Review your order" }),
      ).toBeVisible();
      await expect(
        customerPage.getByRole("link", {
          name: "Visit Phase 5 E2E Business website",
        }),
      ).toHaveCount(0);
      await expect(
        customerPage.getByRole("link", {
          name: "Visit Phase 5 E2E Business on Instagram",
        }),
      ).toHaveCount(0);
      await expectNoPageOverflow(customerPage);
      await customerPage.screenshot({
        path: `${publicConfirmationScreenshotDirectory}/ready-without-links-390.png`,
        fullPage: true,
      });

      const { error: linksRestoredError } = await admin
        .from("businesses")
        .update({
          website: "https://phase5.example.com/booking",
          instagram: "phase5business",
        })
        .eq("id", ownerFixture.businessId);
      expect(linksRestoredError).toBeNull();
      await customerPage.reload();
      await customerPage.setViewportSize({ width: 390, height: 900 });
      const publicScreenshotChrome = await customerPage.addStyleTag({
        content: "nextjs-portal { visibility: hidden !important; }",
      });
      await expect(
        customerPage.getByRole("heading", { name: "Review your order" }),
      ).toBeVisible();

      await customerPage.getByRole("button", { name: "Confirm booking" }).click();
      await expect(customerPage.getByText("Email address is required.")).toBeVisible();
      await expectNoPageOverflow(customerPage);
      await customerPage.screenshot({
        path: `${publicConfirmationScreenshotDirectory}/validation-error-390.png`,
        fullPage: true,
      });
      await publicScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }

    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await customerPage.setViewportSize({
        width,
        height: width < 768 ? 900 : 1000,
      });
      await expectNoPageOverflow(customerPage);
      await expect(
        customerPage.getByRole("button", { name: "Confirm booking" }),
      ).toBeVisible();
      await expect(
        customerPage.getByRole("link", { name: "Learn more about My Kustomers" }),
      ).toBeVisible();
    }
    if (customerConfirmationViewport) {
      await customerPage.setViewportSize(customerConfirmationViewport);
    }

    await customerPage
      .getByLabel("Email address")
      .fill("customer-confirmation@example.com");
    await customerPage.getByLabel("Phone number (optional)").fill("+353 01 555 0155");
    await customerPage.getByRole("button", { name: "Confirm booking" }).click();
    await expect(customerPage).toHaveURL(/confirmed=1/, { timeout: 15_000 });
    await expect(
      customerPage.getByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-state="open"]').getByText("Customer confirmed", {
        exact: true,
      }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(
      customerPage.getByText("We'll send a confirmation to c***@example.com."),
    ).toBeVisible();

    const [
      { data: capturedCustomer },
      { data: confirmationRows },
      { data: emailEvents },
    ] = await Promise.all([
      admin
        .from("customers")
        .select("email, phone")
        .eq("id", fixture.customerId)
        .single(),
      admin
        .from("booking_confirmations")
        .select("contact_email, contact_phone")
        .eq("booking_id", new URL(bookingDetailUrl).pathname.split("/").at(-1) ?? ""),
      admin
        .from("email_events")
        .select("recipient_email, status, attempt_count, provider_message_id")
        .eq("business_id", fixture.businessId),
    ]);
    expect(capturedCustomer).toEqual({
      email: "customer-confirmation@example.com",
      phone: "+353 01 555 0155",
    });
    expect(confirmationRows).toEqual([
      {
        contact_email: "customer-confirmation@example.com",
        contact_phone: "+353 01 555 0155",
      },
    ]);
    expect(emailEvents).toHaveLength(1);
    expect(emailEvents?.[0]).toMatchObject({
      recipient_email: "customer-confirmation@example.com",
      status: "SENT",
      attempt_count: 1,
    });
    expect(emailEvents?.[0].provider_message_id).toMatch(/^development-/);

    await customerPage.goto(confirmationUrl);
    await expect(
      customerPage.getByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();

    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^In progress$/ }),
    ).toBeVisible();
    await expect(page.getByText("customer-confirmation@example.com")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Customer confirmed - work in progress" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark as ready" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as delivered" })).toHaveCount(0);
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("confirmation_links")
            .select("first_opened_at")
            .eq(
              "token_hash",
              hashConfirmationToken(
                new URL(confirmationUrl).pathname.split("/").at(-1) ?? "",
              ),
            )
            .single();
          return Boolean(data?.first_opened_at);
        },
        { timeout: serverActionTimeout },
      )
      .toBe(true);
    await customerPage.close();
    await page.reload();
    await expect(page.locator("#operational-progress > h2 > button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expandBookingSection(page, "customer-confirmation");
    await expect(
      page.locator("#customer-confirmation > h2").getByText("Customer confirmed", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Share with customer" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Regenerate link" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Revoke link" })).toHaveCount(0);
    if (testInfo.project.name === "chromium") {
      const confirmedConfirmationViewport = page.viewportSize();
      const confirmedScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.locator("#customer-confirmation").screenshot({
        path: "test-results/customer-confirmation-panel/customer-confirmation-confirmed-390.png",
      });
      await confirmedScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (confirmedConfirmationViewport) {
        await page.setViewportSize(confirmedConfirmationViewport);
      }
    }
    await expect(page.getByText("sent", { exact: true })).toBeVisible();
    await expect(page.getByText(/Copy link selected/)).toBeVisible();
    await expect(
      page.getByText("First viewed").first().locator("..").getByText("Not available"),
    ).toHaveCount(0);

    await page.goto(`/customers/${fixture.customerId}`);
    await expect(page.getByLabel("Email")).toHaveValue(
      "customer-confirmation@example.com",
    );
    await expect(page.getByLabel("Phone")).toHaveValue("+353 01 555 0155");
    await page.goto(bookingDetailUrl);

    await expandBookingSection(page, "booking-changes");
    await page.getByRole("button", { name: "Propose change" }).click();
    await page
      .getByLabel("Reason for changes")
      .fill("Customer requested a larger scope and later date.");
    await page.getByLabel("Proposed booking title").fill(amendedTitle);
    await page.getByLabel("Proposed details").fill("Approved expanded E2E scope.");
    await page.getByLabel("Proposed agreed total").fill("55000");
    await page.getByLabel("Proposed deposit recorded").fill("7000");
    await page.getByLabel("Proposed date and time").fill(futureLocalDateTimePlus(3));
    await page.getByRole("button", { name: "Send changes for confirmation" }).click();

    await expect(
      page.getByText("Changes are awaiting customer confirmation."),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(
      page.getByText("Changes are waiting for customer approval.", { exact: false }),
    ).toBeVisible();
    const amendmentLinkInput = page.getByLabel("Generated amendment link");
    await expect(amendmentLinkInput).toBeAttached();
    const amendmentUrl = await amendmentLinkInput.inputValue();
    expect(amendmentUrl).toContain("/a/");
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
    await expandBookingSection(page, "booking-payments");
    await expect(page.getByText("₦45,000").first()).toBeVisible();

    await page.getByRole("button", { name: "Share booking changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Share booking changes" }),
    ).toBeVisible();
    expect(await page.getByLabel("Message").inputValue()).toContain(
      "has proposed an update to your booking",
    );
    await expect(page.getByLabel("Booking change link")).toHaveValue(amendmentUrl);
    await page.getByRole("button", { name: "Copy link" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(amendmentUrl);
    await page.getByRole("button", { name: "Close dialog" }).click();

    const amendmentPreview = await page.request.get(amendmentUrl, {
      headers: {
        "user-agent": `TelegramBot (amendment-e2e-${testInfo.project.name})`,
      },
    });
    const amendmentPreviewHtml = await amendmentPreview.text();
    expect(amendmentPreviewHtml).toContain(
      "Review an update to your booking with Phase 5 E2E Business",
    );
    expect(amendmentPreviewHtml).not.toContain(customerName);
    expect(amendmentPreviewHtml).not.toContain(amendedTitle);
    expect(amendmentPreviewHtml).not.toContain("55000");

    const originalViewport = page.viewportSize();
    await page.goto(amendmentUrl);
    await expect(
      page.getByRole("heading", { name: "Review booking changes" }),
    ).toBeVisible();
    await expect(page.getByText("Current", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Proposed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(amendedTitle)).toBeVisible();
    await expect(page.getByText("₦55,000")).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      await expect(page.getByRole("button", { name: "Confirm changes" })).toBeVisible();
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.getByRole("button", { name: "Confirm changes" }).click();
    await expect(page).toHaveURL(/confirmed=1/);
    await expect(
      page.getByRole("heading", { name: "Booking changes confirmed" }),
    ).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(page.getByRole("heading", { name: amendedTitle })).toBeVisible();
    await expandBookingSection(page, "booking-changes");
    await expect(page.getByText("Latest request:")).toBeVisible();
    if (testInfo.project.name === "chromium") {
      const confirmedChangesViewport = page.viewportSize();
      const confirmedChangesScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await expectNoPageOverflow(page);
      await page.locator("#booking-changes").screenshot({
        path: `${bookingChangesScreenshotDirectory}/booking-changes-confirmed-expanded-390.png`,
        animations: "disabled",
      });
      await confirmedChangesScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (confirmedChangesViewport) await page.setViewportSize(confirmedChangesViewport);
    }
    await expandBookingSection(page, "booking-payments");
    await expect(page.getByText("₦55,000").first()).toBeVisible();
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("Booking amendment proposed")).toBeVisible();
    await expect(page.getByText("Booking amendment confirmed")).toBeVisible();
    await expandBookingSection(page, "booking-details");
    await expect(page.getByLabel("Booking title")).toBeDisabled();

    const { data: originalConfirmationBeforeAddon } = await admin
      .from("booking_confirmations")
      .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
      .eq("booking_id", new URL(bookingDetailUrl).pathname.split("/").at(-1) ?? "")
      .single();

    await expandBookingSection(page, "booking-addons");
    const addonScreenshotChrome =
      testInfo.project.name === "chromium"
        ? await page.addStyleTag({
            content: `
              header,
              nav[aria-label="Mobile vendor navigation"],
              nextjs-portal {
                visibility: hidden !important;
              }
            `,
          })
        : null;
    const addonViewport = page.viewportSize();
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      await expect(
        bookingAddonSection.getByRole("button", { name: "Add item" }),
      ).toBeEnabled();
      await expect(
        bookingAddonSection.getByText("Current agreed value").first(),
      ).toBeVisible();
      await expect(bookingAddonSection.getByText("Value breakdown")).toBeVisible();
      if (addonScreenshotChrome && [320, 390, 768, 1024].includes(width)) {
        await bookingAddonSection.screenshot({
          path: `${bookingAddonScreenshotDirectory}/booking-addons-eligible-expanded-${width}.png`,
          animations: "disabled",
        });
      }
    }
    if (addonViewport) await page.setViewportSize(addonViewport);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("heading", { name: "Add item" })).toBeVisible();
    const addonDialog = page.getByRole("dialog", { name: "Add item" });
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      const dialogBox = await addonDialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width);
      expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
      expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(
        width < 768 ? 900 : 1000,
      );
      if (addonScreenshotChrome && [320, 390, 768, 1024].includes(width)) {
        await addonDialog.screenshot({
          path: `${bookingAddonScreenshotDirectory}/add-item-dialog-${width}.png`,
          animations: "disabled",
        });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByLabel("Title", { exact: true }).fill("   ");
    await page.getByLabel("Agreed amount").fill("invalid");
    await page.getByRole("button", { name: "Save add-on draft" }).click();
    await expect(page.getByText("Add-on title is required.")).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(
      page.getByText("Agreed amount must be a valid amount with up to 2 decimals."),
    ).toBeVisible();
    if (addonScreenshotChrome) {
      await addonDialog.screenshot({
        path: `${bookingAddonScreenshotDirectory}/add-item-validation-390.png`,
        animations: "disabled",
      });
    }
    await page.getByLabel("Title", { exact: true }).fill("24 Cupcakes");
    await page
      .getByRole("dialog")
      .getByLabel("Description", { exact: true })
      .fill("Twenty-four decorated cupcakes for the same delivery.");
    await page.getByLabel("Agreed amount").fill("18000");
    await page.getByLabel("Deposit recorded", { exact: true }).last().fill("5000");
    await page.getByRole("button", { name: "Save add-on draft" }).click();

    await expect(
      page.getByLabel("Booking add-ons").getByText("24 Cupcakes", { exact: true }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByText("₦55,000").first()).toBeVisible();
    if (addonScreenshotChrome) {
      await page.setViewportSize({ width: 390, height: 900 });
      await bookingAddonSection.screenshot({
        path: `${bookingAddonScreenshotDirectory}/booking-addons-draft-390.png`,
        animations: "disabled",
      });
      await addonScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    if (addonViewport) await page.setViewportSize(addonViewport);
    await page.getByRole("button", { name: "Send for confirmation" }).click();
    await expect(page.getByText("Add-on is awaiting customer confirmation.")).toBeVisible(
      {
        timeout: serverActionTimeout,
      },
    );
    await expect(
      page.getByText("An add-on is waiting for customer approval.", { exact: false }),
    ).toBeVisible();
    const addonLinkInput = page.getByLabel("Generated add-on link");
    await expect(addonLinkInput).toBeAttached();
    const addonUrl = await addonLinkInput.inputValue();
    expect(addonUrl).toContain("/x/");
    await expect(page.getByRole("heading", { name: amendedTitle })).toBeVisible();
    await expect(page.getByText("₦55,000").first()).toBeVisible();

    await page.getByRole("button", { name: "Share add-on" }).click();
    await expect(page.getByRole("heading", { name: "Share add-on" })).toBeVisible();
    expect(await page.getByLabel("Message").inputValue()).toContain(
      "has added an item to your existing booking",
    );
    expect(await page.getByLabel("Message").inputValue()).not.toContain("₦18,000");
    await expect(page.getByLabel("Booking add-on link")).toHaveValue(addonUrl);
    await page.getByRole("button", { name: "Copy link" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(addonUrl);
    await page.getByRole("button", { name: "Close dialog" }).click();

    const addonPreview = await page.request.get(addonUrl, {
      headers: {
        "user-agent": `TelegramBot (addon-e2e-${testInfo.project.name})`,
      },
    });
    expect(addonPreview.ok()).toBe(true);
    const addonPreviewHtml = await addonPreview.text();
    expect(addonPreviewHtml).toContain(
      "Review an addition to your booking with Phase 5 E2E Business",
    );
    expect(addonPreviewHtml).not.toContain(customerName);
    expect(addonPreviewHtml).not.toContain("24 Cupcakes");
    expect(addonPreviewHtml).not.toContain("18000");
    const { data: addonLinkAfterCrawler } = await admin
      .from("booking_addon_confirmation_links")
      .select("first_opened_at")
      .eq(
        "token_hash",
        hashAddonToken(new URL(addonUrl).pathname.split("/").at(-1) ?? ""),
      )
      .single();
    expect(addonLinkAfterCrawler?.first_opened_at).toBeNull();

    await page.goto(addonUrl);
    await expect(
      page.getByRole("heading", { name: "Review an addition to your booking" }),
    ).toBeVisible();
    await expect(page.getByText("24 Cupcakes", { exact: true })).toBeVisible();
    await expect(page.getByText("₦18,000")).toBeVisible();
    await expect(page.getByText("₦5,000")).toBeVisible();
    await expect(page.getByText("Same delivery:")).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      await expect(page.getByRole("button", { name: "Confirm add-on" })).toBeVisible();
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
    await page.getByRole("button", { name: "Confirm add-on" }).click();
    await expect(page).toHaveURL(/confirmed=1/);
    await expect(
      page.getByRole("heading", { name: "Booking addition confirmed" }),
    ).toBeVisible();

    const bookingId = new URL(bookingDetailUrl).pathname.split("/").at(-1) ?? "";
    const [{ data: addonRows }, { data: originalConfirmationAfterAddon }] =
      await Promise.all([
        admin
          .from("booking_addons")
          .select("title, status, total_amount_minor, deposit_amount_minor, terms_hash")
          .eq("booking_id", bookingId),
        admin
          .from("booking_confirmations")
          .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
          .eq("booking_id", bookingId)
          .single(),
      ]);
    expect(addonRows).toEqual([
      {
        title: "24 Cupcakes",
        status: "CONFIRMED",
        total_amount_minor: 1_800_000,
        deposit_amount_minor: 500_000,
        terms_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    ]);
    expect(originalConfirmationAfterAddon).toEqual(originalConfirmationBeforeAddon);

    await page.goto(bookingDetailUrl);
    await expandBookingSection(page, "booking-addons");
    await expect(
      bookingAddonSection.getByText("24 Cupcakes", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      bookingAddonSection.getByText("Confirmed", { exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "chromium") {
      const confirmedAddonViewport = page.viewportSize();
      const confirmedAddonScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await expectNoPageOverflow(page);
      await bookingAddonSection.screenshot({
        path: `${bookingAddonScreenshotDirectory}/booking-addons-confirmed-390.png`,
        animations: "disabled",
      });
      await confirmedAddonScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (confirmedAddonViewport) await page.setViewportSize(confirmedAddonViewport);
    }
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("Booking add-on confirmed")).toBeVisible();
    await expandBookingSection(page, "booking-payments");
    await expect(page.getByText("₦73,000").first()).toBeVisible();
    await expect(page.getByText("₦12,000").first()).toBeVisible();
    await expect(page.getByText("₦61,000").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel add-on" })).toHaveCount(0);

    const paymentViewport = page.viewportSize();
    const paymentScreenshotDirectory = "test-results/payment-completion-panel";
    const paymentViewportHeights = new Map([
      [320, 568],
      [360, 800],
      [375, 812],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ]);
    if (testInfo.project.name === "chromium") {
      fs.mkdirSync(paymentScreenshotDirectory, { recursive: true });
    }
    const paymentScreenshotChrome =
      testInfo.project.name === "chromium"
        ? await page.addStyleTag({
            content: `
              header,
              nav[aria-label="Mobile vendor navigation"],
              nextjs-portal {
                visibility: hidden !important;
              }
            `,
          })
        : null;
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({
        width,
        height: paymentViewportHeights.get(width) ?? 900,
      });
      await expectNoPageOverflow(page);
      await expect(page.getByRole("heading", { name: "Payment record" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
      if (testInfo.project.name === "chromium" && [320, 390, 768, 1024].includes(width)) {
        await page.locator("#booking-payments").screenshot({
          path: `${paymentScreenshotDirectory}/payment-completion-expanded-${width}.png`,
          animations: "disabled",
        });
      }
    }
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      const paymentTrigger = page.locator("#booking-payments > h2 > button");
      await paymentTrigger.click();
      await expect(paymentTrigger).toHaveAttribute("aria-expanded", "false");
      await page.locator("#booking-payments").screenshot({
        path: `${paymentScreenshotDirectory}/payment-completion-collapsed-390.png`,
        animations: "disabled",
      });
      await paymentTrigger.click();
      await expect(paymentTrigger).toHaveAttribute("aria-expanded", "true");
    }
    if (paymentScreenshotChrome) {
      await paymentScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    if (paymentViewport) await page.setViewportSize(paymentViewport);

    await page.getByRole("button", { name: "Record payment" }).click();
    const partialPaymentDialog = page.getByRole("dialog", { name: "Record a payment" });
    await partialPaymentDialog.getByLabel("Payment amount").fill("10000");
    await partialPaymentDialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("₦22,000").first()).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("₦51,000").first()).toBeVisible();

    await expandBookingSection(page, "reschedule");
    const rescheduleSection = page.locator("#reschedule");
    const rescheduleTrigger = page.locator("#reschedule > h2 > button");
    const rescheduleScreenshotDirectory = "test-results/reschedule-panel";
    const rescheduleViewport = page.viewportSize();
    const rescheduleViewportHeights = new Map([
      [320, 568],
      [360, 800],
      [375, 812],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ]);
    if (testInfo.project.name === "chromium") {
      fs.mkdirSync(rescheduleScreenshotDirectory, { recursive: true });
    }
    const rescheduleScreenshotChrome =
      testInfo.project.name === "chromium"
        ? await page.addStyleTag({
            content: `
              header,
              nav[aria-label="Mobile vendor navigation"],
              nextjs-portal {
                visibility: hidden !important;
              }
            `,
          })
        : null;
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({
        width,
        height: rescheduleViewportHeights.get(width) ?? 900,
      });
      await expectNoPageOverflow(page);
      await expect(rescheduleTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel("New scheduled date")).toBeVisible();
      await expect(
        rescheduleSection.getByRole("button", { name: "Reschedule", exact: true }),
      ).toBeVisible();
      if (testInfo.project.name === "chromium" && [320, 390, 768, 1024].includes(width)) {
        await rescheduleSection.screenshot({
          path: `${rescheduleScreenshotDirectory}/reschedule-expanded-${width}.png`,
          animations: "disabled",
        });
      }
    }
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      await rescheduleTrigger.click();
      await expect(rescheduleTrigger).toHaveAttribute("aria-expanded", "false");
      await rescheduleSection.screenshot({
        path: `${rescheduleScreenshotDirectory}/reschedule-collapsed-390.png`,
        animations: "disabled",
      });
      await rescheduleTrigger.click();
      await expect(rescheduleTrigger).toHaveAttribute("aria-expanded", "true");
    }

    const nextScheduledFor = futureLocalDateTimePlus(2);
    await page.getByLabel("New scheduled date").fill(nextScheduledFor);
    if (testInfo.project.name === "chromium") {
      await rescheduleSection.screenshot({
        path: `${rescheduleScreenshotDirectory}/reschedule-populated-390.png`,
        animations: "disabled",
      });
    }

    let delayedRescheduleRequest = false;
    const delayRescheduleRequest = async (route: PlaywrightRoute) => {
      if (!delayedRescheduleRequest && route.request().method() === "POST") {
        delayedRescheduleRequest = true;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      await route.continue();
    };
    await page.route(bookingDetailUrl, delayRescheduleRequest);
    await page.getByRole("button", { name: "Reschedule", exact: true }).click();
    const pendingRescheduleButton = page.getByRole("button", {
      name: "Rescheduling...",
    });
    await expect(pendingRescheduleButton).toBeDisabled();
    if (testInfo.project.name === "chromium") {
      await rescheduleSection.screenshot({
        path: `${rescheduleScreenshotDirectory}/reschedule-pending-390.png`,
        animations: "disabled",
      });
    }
    await expect(
      page.getByText(
        "Booking rescheduled. The new confirmation request was accepted for delivery.",
      ),
    ).toBeVisible({ timeout: serverActionTimeout });
    await page.unroute(bookingDetailUrl, delayRescheduleRequest);
    expect(delayedRescheduleRequest).toBe(true);
    await expect(
      rescheduleSection.getByText(
        "The customer will need to confirm the updated schedule. Email delivery is attempted using the saved confirmation address.",
      ),
    ).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await rescheduleSection.screenshot({
        path: `${rescheduleScreenshotDirectory}/reschedule-reconfirmation-390.png`,
        animations: "disabled",
      });
    }
    if (rescheduleScreenshotChrome) {
      await rescheduleScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    if (rescheduleViewport) await page.setViewportSize(rescheduleViewport);
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Awaiting customer$/ }),
    ).toBeVisible();
    await expect(page.getByText("Booking rescheduled", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Waiting for customer confirmation" }),
    ).toBeVisible();
    await expect(
      page.getByText("The delivery schedule changed.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);

    await expandBookingSection(page, "customer-confirmation");
    const { data: rescheduleEvents } = await admin
      .from("email_events")
      .select("event_type, status, booking_change_id, confirmation_link_id")
      .eq("business_id", fixture.businessId)
      .eq("event_type", "BOOKING_RESCHEDULED");
    expect(rescheduleEvents).toEqual([
      {
        event_type: "BOOKING_RESCHEDULED",
        status: "SENT",
        booking_change_id: expect.any(String),
        confirmation_link_id: expect.any(String),
      },
    ]);

    await page
      .getByRole("button", { name: /Generate confirmation link|Regenerate link/ })
      .click();
    const regeneratedLinkInput = page.getByLabel("Generated confirmation link");
    await expect(regeneratedLinkInput).toBeAttached({ timeout: 15_000 });
    const regeneratedConfirmationUrl = await regeneratedLinkInput.inputValue();
    expect(regeneratedConfirmationUrl).toContain("/c/");

    await page.goto(regeneratedConfirmationUrl);
    await page.getByLabel("Email address").fill("customer-confirmation@example.com");
    await page.getByLabel("Phone number (optional)").fill("+353 01 555 0155");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^In progress$/ }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("Confirmed to In progress").last()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Customer confirmed - work in progress" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);

    await page.getByRole("button", { name: "Mark as ready" }).click();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Ready for delivery$/ }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("In progress to Ready for delivery")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ready for delivery", exact: true }),
    ).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoPageOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${bookingDetailScreenshotDirectory}/booking-detail-ready-390.png`,
        animations: "disabled",
      });
    }

    let releaseDeliveryRequest: (() => void) | undefined;
    const deliveryRequestGate = new Promise<void>((resolve) => {
      releaseDeliveryRequest = resolve;
    });
    let deliveryRequestHeld = false;
    const deliveryRoutePattern = `**/bookings/${bookingSyncId}*`;
    await page.route(deliveryRoutePattern, async (route) => {
      if (!deliveryRequestHeld && route.request().method() === "POST") {
        deliveryRequestHeld = true;
        await deliveryRequestGate;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Mark as delivered" }).click();
    const pendingDeliveryButton = page.getByRole("button", {
      name: "Marking as delivered...",
    });
    await expect(pendingDeliveryButton).toBeVisible();
    await expect(pendingDeliveryButton).toBeDisabled();
    if (testInfo.project.name === "chromium") {
      await page.screenshot({
        path: `${bookingDetailScreenshotDirectory}/booking-detail-delivery-pending-390.png`,
        animations: "disabled",
      });
    }
    releaseDeliveryRequest?.();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Delivered$/ }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await page.unroute(deliveryRoutePattern);
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("Ready for delivery to Delivered")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivered", exact: true }),
    ).toBeVisible();
    const { data: deliveryEvents } = await admin
      .from("email_events")
      .select("event_type, status, attempt_count")
      .eq("business_id", fixture.businessId)
      .eq("event_type", "BOOKING_DELIVERED");
    expect(deliveryEvents).toEqual([
      { event_type: "BOOKING_DELIVERED", status: "SENT", attempt_count: 1 },
    ]);

    await expect(page.getByRole("button", { name: "Complete booking" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Record payment" })).toBeVisible();
    await page.getByRole("link", { name: "Record payment" }).click();
    await page.getByRole("button", { name: "Record payment" }).click();
    const finalPaymentDialog = page.getByRole("dialog", { name: "Record a payment" });
    await finalPaymentDialog.getByLabel("Payment amount").fill("51000");
    await finalPaymentDialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("₦73,000").nth(1)).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("₦0").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Payment & completion.*Payment fully recorded/ }),
    ).toBeVisible();
    if (testInfo.project.name === "chromium") {
      const fullyPaidScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expandBookingSection(page, "booking-payments");
      await expect(page.getByText("Payment complete")).toBeVisible();
      await expectNoPageOverflow(page);
      await page.locator("#booking-payments").screenshot({
        path: `${paymentScreenshotDirectory}/payment-completion-fully-paid-390.png`,
        animations: "disabled",
      });
      await fullyPaidScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }

    await page.getByRole("button", { name: "Complete booking" }).click();
    const completionDialog = page.getByRole("dialog", { name: "Complete this booking?" });
    await expect(completionDialog).toBeVisible();
    await expect(
      completionDialog.getByText(
        "This will mark the booking as completed and move it to the feedback stage.",
      ),
    ).toBeVisible();
    await completionDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(completionDialog).toBeHidden();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Delivered$/ }),
    ).toBeVisible();

    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 320, height: 720 });
    }
    await page.getByRole("button", { name: "Complete booking" }).click();
    await expect(completionDialog).toBeVisible();
    await expectNoPageOverflow(page);
    await completionDialog.getByRole("button", { name: "Complete booking" }).click();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Completed$/ }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expandBookingSection(page, "operational-progress");
    for (const stage of ["started", "ready", "delivered", "completed"]) {
      await expect(
        page.locator(`#operational-progress [data-stage="${stage}"] time`),
      ).toBeVisible();
    }
    await expect(
      page.locator('#operational-progress [data-stage="cancelled"]'),
    ).toHaveAttribute("data-state", "pending");
    if (testInfo.project.name === "chromium") {
      const progressedViewport = page.viewportSize();
      const progressedScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await expectNoPageOverflow(page);
      await page.locator("#operational-progress").screenshot({
        path: `${operationalProgressScreenshotDirectory}/operational-progress-completed-expanded-390.png`,
        animations: "disabled",
      });
      await progressedScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (progressedViewport) await page.setViewportSize(progressedViewport);
    }
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("Delivered to Completed")).toBeVisible();
    const operationalTimelineSection = page.locator("#operational-timeline");
    const operationalTimeline = operationalTimelineSection.locator(
      'ol[aria-label="Booking activity timeline"]',
    );
    const operationalTimelineItems = operationalTimeline.locator(":scope > li");
    await expect(operationalTimeline).toHaveAttribute("role", "list");
    expect(await operationalTimelineItems.count()).toBeGreaterThanOrEqual(6);
    await expect(operationalTimelineItems.first()).toContainText("Created as Draft");
    await expect(operationalTimelineItems.last()).toContainText("Delivered to Completed");
    await expect(operationalTimeline).toContainText("Booking rescheduled");
    await expect(operationalTimeline).toContainText("Booking amendment proposed");
    await expect(operationalTimeline).toContainText("Booking add-on confirmed");
    if (testInfo.project.name === "chromium") {
      const timelineViewport = page.viewportSize();
      const timelineScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      for (const { width, height } of [
        { width: 320, height: 568 },
        { width: 360, height: 800 },
        { width: 375, height: 812 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize({ width, height });
        await expectNoPageOverflow(page);
        await expect(operationalTimelineSection.locator("h2 > button")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        if ([320, 390, 768, 1024].includes(width)) {
          await operationalTimelineSection.screenshot({
            path: `${operationalTimelineScreenshotDirectory}/operational-timeline-mixed-expanded-${width}.png`,
            animations: "disabled",
          });
        }
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await operationalTimelineSection.locator("h2 > button").click();
      await expect(operationalTimelineSection.locator("h2 > button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await operationalTimelineSection.screenshot({
        path: `${operationalTimelineScreenshotDirectory}/operational-timeline-collapsed-390.png`,
        animations: "disabled",
      });
      await operationalTimelineSection.locator("h2 > button").click();
      await timelineScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
      if (timelineViewport) await page.setViewportSize(timelineViewport);
    }
    await expect(page.getByRole("heading", { name: "Booking completed" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request feedback" })).toBeVisible();
    await page.getByRole("link", { name: "Request feedback" }).click();
    await expect(page.locator("#private-feedback > h2 > button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const feedbackSection = page.locator("#private-feedback");
    if (testInfo.project.name === "chromium") {
      const feedbackScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      for (const { width, height } of [
        { width: 320, height: 568 },
        { width: 360, height: 800 },
        { width: 375, height: 812 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize({ width, height });
        await expectNoPageOverflow(page);
        if (width === 320 || width === 390) {
          await feedbackSection.screenshot({
            path: `${feedbackScreenshotDirectory}/private-feedback-not-requested-expanded-${width}.png`,
            animations: "disabled",
          });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await feedbackSection.locator("h2 > button").click();
      await expect(feedbackSection.locator("h2 > button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await feedbackSection.screenshot({
        path: `${feedbackScreenshotDirectory}/private-feedback-not-requested-collapsed-390.png`,
        animations: "disabled",
      });
      await feedbackSection.locator("h2 > button").click();
      await feedbackScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    await expandBookingSection(page, "booking-details");
    await expect(
      page.getByText("Completed and cancelled bookings are locked."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Request feedback" }).click();
    const feedbackLinkInput = page.getByLabel("Generated feedback link");
    await expect(feedbackLinkInput).toBeVisible();
    const feedbackUrl = await feedbackLinkInput.inputValue();
    expect(feedbackUrl).toContain("/f/");

    if (testInfo.project.name === "chromium") {
      const feedbackScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      for (const { width, height } of [
        { width: 320, height: 568 },
        { width: 360, height: 800 },
        { width: 375, height: 812 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize({ width, height });
        await expectNoPageOverflow(page);
        if (width === 320 || width === 390) {
          await feedbackSection.screenshot({
            path: `${feedbackScreenshotDirectory}/private-feedback-ready-expanded-${width}.png`,
            animations: "disabled",
          });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await feedbackSection.locator("h2 > button").click();
      await expect(feedbackSection.locator("h2 > button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await feedbackSection.screenshot({
        path: `${feedbackScreenshotDirectory}/private-feedback-ready-collapsed-390.png`,
        animations: "disabled",
      });
      await feedbackSection.locator("h2 > button").click();
      await feedbackScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }

    await page.getByRole("button", { name: "Share feedback request" }).click();
    await expect(
      page.getByRole("heading", { name: "Share feedback request" }),
    ).toBeVisible();
    expect(await page.getByLabel("Message").inputValue()).toContain(
      `Hi ${customerName.split(" ")[0]}, thank you for choosing Phase 5 E2E Business`,
    );
    expect(await page.getByLabel("Message").inputValue()).toContain("private feedback");
    expect(await page.getByLabel("Message").inputValue()).toContain(
      "No account is required",
    );
    await expect(page.getByLabel("Feedback link", { exact: true })).toHaveValue(
      feedbackUrl,
    );
    await page.getByRole("button", { name: "Copy message" }).click();
    await expect(page.getByText("Message copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      `\n\n${feedbackUrl}`,
    );
    await page.getByRole("button", { name: "Close dialog" }).click();

    const feedbackToken = new URL(feedbackUrl).pathname.split("/").at(-1) ?? "";
    const feedbackPreviewResponse = await page.request.get(feedbackUrl, {
      headers: {
        "user-agent": `TelegramBot (feedback-sharing-e2e-${testInfo.project.name})`,
      },
    });
    expect(feedbackPreviewResponse.ok()).toBe(true);
    const feedbackPreviewHtml = await feedbackPreviewResponse.text();
    expect(feedbackPreviewHtml).toContain(
      "Share private feedback with Phase 5 E2E Business",
    );
    expect(feedbackPreviewHtml).toContain(
      "Phase 5 E2E Business has requested private feedback about your experience.",
    );
    expect(feedbackPreviewHtml).not.toContain(customerName);
    expect(feedbackPreviewHtml).not.toContain(amendedTitle);
    expect(feedbackPreviewHtml).not.toContain("MC-");
    const { data: feedbackLinkAfterCrawler } = await admin
      .from("feedback_links")
      .select("id, first_opened_at")
      .eq("token_hash", hashFeedbackToken(feedbackToken))
      .single();
    expect(feedbackLinkAfterCrawler?.first_opened_at).toBeNull();
    expect(feedbackLinkAfterCrawler?.id).toBeTruthy();

    const feedbackPage = await context.newPage();
    const feedbackResponse = await feedbackPage.goto(feedbackUrl);
    expect(feedbackResponse?.headers()["cache-control"]).toContain("no-store");
    expect(feedbackResponse?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(feedbackResponse?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(
      feedbackPage.getByRole("heading", { name: "Private feedback" }),
    ).toBeVisible();
    await expect(feedbackPage.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Share private feedback with Phase 5 E2E Business",
    );
    await expect(feedbackPage.getByText(amendedTitle)).toBeVisible();
    await expect(feedbackPage.getByText("Updated private E2E note.")).toHaveCount(0);
    await expect(feedbackPage.getByText("Balance remaining")).toHaveCount(0);
    await expect(
      feedbackPage.getByText("Secure · Private · No account required"),
    ).toBeVisible();
    await expect(
      feedbackPage.getByText(
        "Your feedback is completely private and shared only with the business.",
      ),
    ).toBeVisible();
    await expect(
      feedbackPage.getByText("Phase 5 E2E Business", { exact: true }).first(),
    ).toBeVisible();
    await expect(feedbackPage.getByText(bookingReference, { exact: true })).toBeVisible();
    await expect(feedbackPage.getByLabel("What could we do better?")).toHaveAttribute(
      "maxlength",
      "2000",
    );
    await expect(feedbackPage.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "https://mykustomers.com",
    );
    await expect(feedbackPage.getByText("MyKustomers.com").first()).toBeVisible();
    await expect(feedbackPage.getByText("MyCustomers.com")).toHaveCount(0);
    await expect(feedbackPage.getByText("My Customers", { exact: true })).toHaveCount(0);

    if (testInfo.project.name === "chromium") {
      const screenshotWidths = new Set([320, 390, 430, 768, 1024]);
      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await feedbackPage.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
        await expectNoPageOverflow(feedbackPage);
        await expect(
          feedbackPage.getByRole("button", { name: "Submit private feedback" }),
        ).toBeVisible();
        if (screenshotWidths.has(width)) {
          await feedbackPage.screenshot({
            path: `${publicFeedbackScreenshotDirectory}/public-feedback-empty-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      }

      await feedbackPage.setViewportSize({ width: 390, height: 844 });
      await feedbackPage.locator('input[name="overallRating"][value="5"]').check();
      await feedbackPage.locator('input[name="onTime"][value="yes"]').check();
      await feedbackPage
        .getByLabel("What could we do better?")
        .fill("Everything was handled privately.");
      await expect(feedbackPage.locator("#comment-count")).toHaveText("33/2000");
      await expectNoPageOverflow(feedbackPage);
      await feedbackPage.screenshot({
        path: `${publicFeedbackScreenshotDirectory}/public-feedback-partial-390.png`,
        fullPage: true,
        animations: "disabled",
      });

      const validationFeedbackPage = await context.newPage();
      await validationFeedbackPage.setViewportSize({ width: 390, height: 844 });
      await validationFeedbackPage.goto(`${feedbackUrl}?attempt=failed`);
      await expect(validationFeedbackPage.getByRole("alert")).toContainText(
        "could not be submitted",
      );
      await expectNoPageOverflow(validationFeedbackPage);
      await validationFeedbackPage.screenshot({
        path: `${publicFeedbackScreenshotDirectory}/public-feedback-validation-error-390.png`,
        fullPage: true,
        animations: "disabled",
      });
      await validationFeedbackPage.close();

      await feedbackPage.locator('input[name="metExpectations"][value="yes"]').check();
      await feedbackPage.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>("[data-feedback-form]");
        form?.addEventListener("submit", (event) => event.preventDefault(), {
          once: true,
        });
        form?.dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true }),
        );
      });
      await expect(
        feedbackPage.getByRole("button", { name: "Submitting feedback..." }),
      ).toBeDisabled();
      await feedbackPage.screenshot({
        path: `${publicFeedbackScreenshotDirectory}/public-feedback-pending-390.png`,
        fullPage: true,
        animations: "disabled",
      });
      await feedbackPage.goto(feedbackUrl);
    }

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("feedback_links")
          .select("first_opened_at")
          .eq("token_hash", hashFeedbackToken(feedbackToken))
          .single();
        return data?.first_opened_at ?? null;
      })
      .not.toBeNull();

    const { data: feedbackShareAudits } = await admin
      .from("audit_logs")
      .select("metadata")
      .eq("event_type", "FEEDBACK_SHARE_INITIATED")
      .contains("metadata", {
        feedback_link_id: feedbackLinkAfterCrawler!.id,
        method: "copy_message",
      });
    expect(feedbackShareAudits?.length).toBeGreaterThan(0);
    expect(JSON.stringify(feedbackShareAudits)).not.toContain(feedbackToken);

    if (testInfo.project.name === "chromium") {
      const reloadedAdminPage = await context.newPage();
      await reloadedAdminPage.setViewportSize({ width: 390, height: 844 });
      await reloadedAdminPage.goto(page.url());
      await expandBookingSection(reloadedAdminPage, "private-feedback");
      await expect(
        reloadedAdminPage.getByText("An active feedback request exists."),
      ).toBeVisible();
      await expect(
        reloadedAdminPage.getByRole("button", { name: "Share feedback request" }),
      ).toHaveCount(0);
      await expectNoPageOverflow(reloadedAdminPage);
      await reloadedAdminPage.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await reloadedAdminPage.locator("#private-feedback").screenshot({
        path: `${feedbackScreenshotDirectory}/private-feedback-active-reloaded-390.png`,
        animations: "disabled",
      });
      await reloadedAdminPage.close();
    }

    await feedbackPage.locator('input[name="overallRating"][value="5"]').check();
    await feedbackPage.locator('input[name="onTime"][value="yes"]').check();
    await feedbackPage.locator('input[name="metExpectations"][value="yes"]').check();
    await feedbackPage
      .getByLabel("What could we do better?")
      .fill("Everything was handled privately.");
    await feedbackPage.getByRole("button", { name: "Submit private feedback" }).click();
    await expect(feedbackPage).toHaveURL(/submitted=1/);
    await expect(
      feedbackPage.getByRole("heading", { name: "Thank you for your feedback" }),
    ).toBeVisible();
    await expect(feedbackPage.getByText("It is not posted publicly.")).toBeVisible();

    await expect(
      page.locator('[data-state="open"]').getByText("New customer feedback", {
        exact: true,
      }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText("Everything was handled privately.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request feedback" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Feedback received", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("The booking journey is complete.")).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoPageOverflow(page);
      const submittedScreenshotChrome = await page.addStyleTag({
        content: `
          header,
          nav[aria-label="Mobile vendor navigation"],
          nextjs-portal {
            visibility: hidden !important;
          }
        `,
      });
      await feedbackSection.screenshot({
        path: `${feedbackScreenshotDirectory}/private-feedback-submitted-390.png`,
        animations: "disabled",
      });
      await submittedScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    await feedbackPage.close();

    await expandBookingSection(page, "operational-issues");
    await page.getByLabel("Category").selectOption("LATE_DELIVERY");
    await page
      .getByLabel("Issue description")
      .fill("Delivery finished after the agreed time.");
    const issueViewport = page.viewportSize();
    const issueScreenshotChrome =
      testInfo.project.name === "chromium"
        ? await page.addStyleTag({
            content: `
              header,
              nav[aria-label="Mobile vendor navigation"],
              nextjs-portal {
                visibility: hidden !important;
              }
            `,
          })
        : null;
    if (issueScreenshotChrome) {
      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoPageOverflow(page);
      await expect(page.getByText("New customer feedback", { exact: true })).toBeHidden({
        timeout: 10_000,
      });
      await operationalIssuesSection.screenshot({
        path: `${operationalIssuesScreenshotDirectory}/operational-issues-populated-390.png`,
        animations: "disabled",
      });
    }
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByText("Issue created.")).toBeVisible();
    await expandBookingSection(page, "operational-issues");
    await expect(page.locator("li").filter({ hasText: "Late delivery" })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Open$/ })).toBeVisible();
    if (issueScreenshotChrome) {
      await expectNoPageOverflow(page);
      await operationalIssuesSection.screenshot({
        path: `${operationalIssuesScreenshotDirectory}/operational-issues-open-390.png`,
        animations: "disabled",
      });
    }

    await page.getByRole("button", { name: "Resolve issue" }).click();
    await expect(page).toHaveURL(/message=issue-resolved/, {
      timeout: serverActionTimeout * 2,
    });
    await expect(page.getByText("Issue resolved.")).toBeVisible();
    await expandBookingSection(page, "operational-issues");
    await expect(page.locator("span").filter({ hasText: /^Resolved$/ })).toBeVisible();
    if (issueScreenshotChrome) {
      await expectNoPageOverflow(page);
      await operationalIssuesSection.screenshot({
        path: `${operationalIssuesScreenshotDirectory}/operational-issues-resolved-390.png`,
        animations: "disabled",
      });
      await issueScreenshotChrome.evaluate((element) =>
        element.parentNode?.removeChild(element),
      );
    }
    if (issueViewport) await page.setViewportSize(issueViewport);

    await page.goto("/insights?range=this_month");
    await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    await expect(
      page.getByText("Private metrics calculated from saved business records."),
    ).toBeVisible();
    const completedBookingsCard = page
      .getByRole("heading", { name: "Completed bookings" })
      .locator("../..");
    await expect(completedBookingsCard.getByText("1", { exact: true })).toBeVisible();
    const feedbackResponsesCard = page
      .getByRole("heading", { name: "Feedback responses" })
      .locator("../..");
    await expect(feedbackResponsesCard.getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByText("₦73,000").first()).toBeVisible();
    await expect(page.getByText("Late delivery")).toBeVisible();
    await expect(page.getByText("Everything was handled privately.")).toHaveCount(0);
  });

  test("booking and customer-picker search update live without resetting form state", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once.",
    );
    test.setTimeout(90_000);

    const email = testEmail(testInfo.project.name);
    const password = `Phase5-Search-${randomUUID()}-A1`;
    const suffix = randomUUID().slice(0, 8);
    const slug = `phase5-search-${Date.now()}-${suffix}`;
    const customerName = `Search Customer Sarah ${suffix}`;
    const bookingTitle = `Search Booking Sarah ${suffix}`;
    createdBusinessSlugs.add(slug);
    const { businessId, customerId, userId } = await createConfirmedBusinessOwner({
      email,
      password,
      slug,
      customerName,
      customerEmail: `search-${suffix}@example.com`,
    });
    expect(customerId).toBeTruthy();
    const admin = createAdminClient();
    const { error: listFixtureError } = await admin.from("bookings").insert(
      Array.from({ length: 54 }, (_, index) => ({
        business_id: businessId,
        customer_id: customerId!,
        title: `Booking List Fixture ${String(index + 1).padStart(2, "0")} ${suffix}`,
        currency: "NGN" as const,
        total_amount_minor: 10_000 + index,
        deposit_amount_minor: 0,
        created_by: userId,
      })),
    );
    expect(listFixtureError).toBeNull();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page
      .getByLabel("Description")
      .fill("Preserve this while customer search updates.");
    await page.getByLabel("Agreed total").fill("1250");
    await page.getByLabel("Deposit recorded").fill("250");
    await page.getByLabel("Search existing customers").fill(`Sarah ${suffix}`);
    const candidate = page.getByRole("option", { name: new RegExp(customerName) });
    await expect(candidate).toBeVisible();
    await expect(page.getByLabel("Booking title")).toHaveValue(bookingTitle);
    await expect(page.getByLabel("Description")).toHaveValue(
      "Preserve this while customer search updates.",
    );
    await candidate.click();
    await expect(page.locator("#customerId")).toContainText(customerName);
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/, {
      timeout: serverActionTimeout,
    });

    await page.goto("/bookings?filter=active&page=7");
    await page.getByLabel("Search bookings").fill(bookingTitle);
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(bookingTitle);
    expect(new URL(page.url()).searchParams.get("filter")).toBe("active");
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await expect(
      page.getByRole("link", { name: new RegExp(bookingTitle) }),
    ).toBeVisible();

    await page.getByText("More statuses", { exact: true }).click();
    await page.getByRole("link", { name: "Draft", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("DRAFT");
    expect(new URL(page.url()).searchParams.get("q")).toBe(bookingTitle);
    await expect(
      page.getByRole("link", { name: new RegExp(bookingTitle) }),
    ).toBeVisible();

    await page.getByLabel("Search bookings").fill(`No match ${suffix}`);
    await expect(page.getByText("No saved bookings matched this search.")).toBeVisible();
    await page.getByRole("button", { name: "Clear booking search" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    expect(new URL(page.url()).searchParams.get("filter")).toBe("DRAFT");
    await expect(
      page.getByRole("link", { name: new RegExp(bookingTitle) }),
    ).toBeVisible();

    await expect(page.getByText("Showing 25 of 55 bookings.")).toBeVisible();
    const { error: newerBookingError } = await admin.from("bookings").insert({
      business_id: businessId,
      customer_id: customerId!,
      title: `Newer Booking During Load ${suffix}`,
      currency: "NGN",
      total_amount_minor: 20_000,
      deposit_amount_minor: 0,
      created_by: userId,
    });
    expect(newerBookingError).toBeNull();

    let loadMoreRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/bookings/list") {
        loadMoreRequests += 1;
      }
    });
    const loadMore = page.getByRole("button", { name: "Load more" });
    await loadMore.evaluate((button) => {
      (button as HTMLElement).click();
      (button as HTMLElement).click();
    });
    await expect(page.getByText("Showing 50 of 55 bookings.")).toBeVisible();
    expect(loadMoreRequests).toBe(1);
    await loadMore.click();
    await expect(page.getByText("Showing 55 of 55 bookings.")).toBeVisible();
    await expect(loadMore).toHaveCount(0);
    const bookingHrefs = await page
      .locator('a[href^="/bookings/"]:not([href="/bookings/new"])')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(bookingHrefs).toHaveLength(55);
    expect(new Set(bookingHrefs).size).toBe(55);
    await expect(page.getByText(`Newer Booking During Load ${suffix}`)).toHaveCount(0);

    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
    }
  });

  test("business user can create a customer inline after an exact-match warning", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    const email = testEmail(`${testInfo.project.name}-inline`);
    const password = `Inline-E2E-${randomUUID()}-A1`;
    const slug = `inline-e2e-bookings-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const existingCustomerName = `Existing Candidate ${randomUUID().slice(0, 8)}`;
    const inlineCustomerName = `Inline Sarah ${randomUUID().slice(0, 8)}`;
    const bookingTitle = `Inline Booking ${randomUUID().slice(0, 8)}`;
    const duplicateEmail = `duplicate-${randomUUID().slice(0, 8)}@example.com`;
    createdBusinessSlugs.add(slug);

    const fixture = await createConfirmedBusinessOwner({
      email,
      password,
      slug,
      customerName: existingCustomerName,
      customerEmail: duplicateEmail,
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.getByRole("button", { name: "Add new customer" }).click();
    await page.getByLabel("Customer name").fill(inlineCustomerName);
    await page
      .getByLabel("Email (optional)", { exact: true })
      .fill(duplicateEmail.toUpperCase());
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Scheduled delivery date").fill(futureLocalDateTime());
    await page.getByLabel("Agreed total").fill("45000");
    await page.getByLabel("Deposit recorded").fill("5000");
    await page.getByRole("button", { name: "Create booking" }).click();

    await expect(
      page.getByText("Possible existing customer", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(existingCustomerName, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Use ${existingCustomerName}` }),
    ).toBeVisible();

    const originalViewport = page.viewportSize();
    for (const width of [320, 360, 375, 390, 430, 768, 834, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      await expectNoPageOverflow(page);
      await expect(page.getByLabel("Booking title")).toHaveValue(bookingTitle);
      await expect(
        page.getByRole("button", { name: `Use ${existingCustomerName}` }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Continue with new customer" }),
      ).toBeVisible();
    }
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }

    await page.getByRole("button", { name: "Continue with new customer" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/);
    await expect(page.getByRole("heading", { name: bookingTitle })).toBeVisible();
    const bookingDetailUrl = page.url();

    const admin = createAdminClient();
    const { data: inlineCustomers, error: inlineCustomersError } = await admin
      .from("customers")
      .select("id, email, phone")
      .eq("business_id", fixture.businessId)
      .eq("name", inlineCustomerName);
    expect(inlineCustomersError).toBeNull();
    expect(inlineCustomers).toEqual([
      { id: expect.any(String), email: duplicateEmail, phone: null },
    ]);
    const inlineCustomerId = inlineCustomers![0].id;

    await page.goto(`/customers?q=${encodeURIComponent(inlineCustomerName)}`);
    await expect(page.getByText(inlineCustomerName)).toBeVisible();
    await page.goto(`/bookings?q=${encodeURIComponent(bookingTitle)}`);
    await expect(page.getByText(bookingTitle)).toBeVisible();

    await page.goto(bookingDetailUrl);
    await page.getByRole("button", { name: "Generate confirmation link" }).click();
    const confirmationUrl = await page
      .getByLabel("Generated confirmation link")
      .inputValue();
    const repeatUserAgent = (await page.evaluate(() => navigator.userAgent)).slice(0, 80);
    await resetLocalRateLimitBuckets(admin, repeatUserAgent, ["lookup", "confirm"]);

    await page.goto(confirmationUrl);
    await expect(page.getByLabel("Phase 5 E2E Business logo")).toBeVisible();
    await expect(page.getByLabel("Phase 5 E2E Business logo").locator("img")).toHaveCount(
      0,
    );
    await page.getByLabel("Email address").fill(duplicateEmail);
    await page.getByLabel("Phone number (optional)").fill("+353 01 555 0188");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    const { data: confirmedInlineCustomer } = await admin
      .from("customers")
      .select("email, phone")
      .eq("id", inlineCustomerId)
      .single();
    expect(confirmedInlineCustomer).toEqual({
      email: duplicateEmail,
      phone: "+353 01 555 0188",
    });
  });

  test("confirmed terms lock while cancellation preserves evidence and sends one notice", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);

    const email = testEmail(`${testInfo.project.name}-cancellation`);
    const password = `Cancellation-E2E-${randomUUID()}-A1`;
    const slug = `cancellation-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const customerName = `Cancellation Customer ${randomUUID().slice(0, 8)}`;
    const bookingTitle = `Cancellation Booking ${randomUUID().slice(0, 8)}`;
    const staleCustomerEmail = `old-${randomUUID().slice(0, 8)}@example.com`;
    const confirmationEmail = `new-${randomUUID().slice(0, 8)}@example.com`;
    const secondBookingEmail = `second-${randomUUID().slice(0, 8)}@example.com`;
    const cancellationReason = "Business is unable to fulfil this booking.";
    createdBusinessSlugs.add(slug);

    const fixture = await createConfirmedBusinessOwner({
      email,
      password,
      slug,
      customerName,
      customerEmail: staleCustomerEmail,
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.locator("#customerId").click();
    await page.locator('[role="option"]').filter({ hasText: customerName }).click();
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Customer-confirmed cancellation E2E.");
    await page.getByLabel("Scheduled delivery date").fill(futureLocalDateTime());
    await page.getByLabel("Agreed total").fill("500");
    await page.getByLabel("Deposit recorded").fill("100");
    await page.getByLabel("Internal notes").fill("Private note before confirmation.");
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/, {
      timeout: 15_000,
    });
    const bookingUrl = page.url();
    const bookingId = new URL(bookingUrl).pathname.split("/").at(-1)!;

    await page.getByRole("button", { name: "Generate confirmation link" }).click();
    const confirmationUrl = await page
      .getByLabel("Generated confirmation link")
      .inputValue();
    const userAgent = (await page.evaluate(() => navigator.userAgent)).slice(0, 80);
    await resetLocalRateLimitBuckets(createAdminClient(), userAgent, [
      "lookup",
      "confirm",
    ]);

    await page.goto(confirmationUrl);
    await page.getByLabel("Email address").fill(confirmationEmail);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(bookingUrl);
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^In progress$/ }),
    ).toBeVisible();
    await expandBookingSection(page, "booking-details");
    await expect(page.getByLabel("Booking title")).toBeDisabled();
    await expect(page.getByLabel("Description", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Currency")).toBeDisabled();
    await expect(page.getByLabel("Agreed total")).toBeDisabled();
    await expect(page.getByLabel("Deposit recorded")).toBeDisabled();
    await expect(page.getByLabel("Internal notes")).toBeEnabled();
    await expect(
      page.getByText("Customer-confirmed booking details are locked.", {
        exact: false,
      }),
    ).toBeVisible();

    await page
      .getByLabel("Internal notes")
      .fill("Updated private note after confirmation.");
    await page.getByRole("button", { name: "Save internal notes" }).click();
    await expect(page.getByText("Internal notes updated.")).toBeVisible({
      timeout: 15_000,
    });

    await page.locator("summary").filter({ hasText: "Other actions" }).click();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const cancellationDialog = page.getByRole("dialog", { name: "Cancel this booking?" });
    await expect(cancellationDialog).toBeVisible();
    const reasonInput = cancellationDialog.getByLabel("Cancellation reason");
    await expect(reasonInput).toHaveAttribute("required", "");
    await reasonInput.fill(cancellationReason);
    await cancellationDialog.getByRole("button", { name: "Cancel booking" }).click();
    await expect(
      page.locator("span.inline-flex.w-fit").filter({ hasText: /^Cancelled$/ }),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
    await expect(
      page.getByText("No further fulfilment actions are available."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);
    await expect(
      page.getByText(`Cancellation reason: ${cancellationReason}`),
    ).toBeVisible();
    await expandBookingSection(page, "operational-progress");
    await expect(
      page.locator('#operational-progress [data-stage="cancelled"]'),
    ).toHaveAttribute("data-state", "cancelled");
    await expect(
      page.locator('#operational-progress [data-stage="cancelled"] time'),
    ).toBeVisible();
    await expandBookingSection(page, "operational-timeline");
    await expect(page.getByText("In progress to Cancelled")).toBeVisible();
    await expect(
      page.getByText("Completed and cancelled bookings are locked."),
    ).toBeVisible();

    const admin = createAdminClient();
    const [{ data: customer }, { data: confirmations }, { data: cancellationEvents }] =
      await Promise.all([
        admin.from("customers").select("email").eq("id", fixture.customerId!).single(),
        admin
          .from("booking_confirmations")
          .select("contact_email, terms_hash, terms_snapshot")
          .eq("booking_id", bookingId),
        admin
          .from("email_events")
          .select(
            "recipient_email, event_type, status, attempt_count, provider_message_id",
          )
          .eq("booking_id", bookingId)
          .eq("event_type", "BOOKING_CANCELLED"),
      ]);
    expect(customer?.email).toBe(staleCustomerEmail);
    expect(confirmations).toHaveLength(1);
    expect(confirmations?.[0].contact_email).toBe(confirmationEmail);
    expect(confirmations?.[0].terms_hash).toBeTruthy();
    expect(confirmations?.[0].terms_snapshot).toBeTruthy();
    expect(cancellationEvents).toHaveLength(1);
    expect(cancellationEvents?.[0]).toMatchObject({
      recipient_email: confirmationEmail,
      event_type: "BOOKING_CANCELLED",
      status: "SENT",
      attempt_count: 1,
    });
    expect(cancellationEvents?.[0].provider_message_id).toMatch(/^development-/);

    await page.goto("/bookings/new");
    await page.locator("#customerId").click();
    await page.locator('[role="option"]').filter({ hasText: customerName }).click();
    await page.getByLabel("Booking title").fill(`${bookingTitle} Repeat`);
    await page
      .getByLabel("Description")
      .fill("Repeat booking with booking-specific contact evidence.");
    await page.getByLabel("Scheduled delivery date").fill(futureLocalDateTimePlus(2));
    await page.getByLabel("Agreed total").fill("750");
    await page.getByLabel("Deposit recorded").fill("150");
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/, {
      timeout: serverActionTimeout,
    });
    const secondBookingId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.getByRole("button", { name: "Generate confirmation link" }).click();
    const secondConfirmationUrl = await page
      .getByLabel("Generated confirmation link")
      .inputValue();
    const secondBookingUserAgent = (await page.evaluate(() => navigator.userAgent)).slice(
      0,
      80,
    );
    await resetLocalRateLimitBuckets(admin, secondBookingUserAgent, [
      "lookup",
      "confirm",
    ]);

    await page.goto(secondConfirmationUrl);
    await page.getByLabel("Email address").fill(secondBookingEmail);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible({
      timeout: serverActionTimeout,
    });

    const [
      { data: repeatCustomer },
      { data: bookingContacts },
      { data: confirmationEvents },
    ] = await Promise.all([
      admin.from("customers").select("email").eq("id", fixture.customerId!).single(),
      admin
        .from("booking_confirmations")
        .select("booking_id, contact_email")
        .in("booking_id", [bookingId, secondBookingId]),
      admin
        .from("email_events")
        .select("booking_id, recipient_email, event_type")
        .in("booking_id", [bookingId, secondBookingId])
        .eq("event_type", "BOOKING_CONFIRMED"),
    ]);
    expect(repeatCustomer?.email).toBe(staleCustomerEmail);
    expect(bookingContacts).toEqual(
      expect.arrayContaining([
        { booking_id: bookingId, contact_email: confirmationEmail },
        { booking_id: secondBookingId, contact_email: secondBookingEmail },
      ]),
    );
    expect(confirmationEvents).toEqual(
      expect.arrayContaining([
        {
          booking_id: bookingId,
          recipient_email: confirmationEmail,
          event_type: "BOOKING_CONFIRMED",
        },
        {
          booking_id: secondBookingId,
          recipient_email: secondBookingEmail,
          event_type: "BOOKING_CONFIRMED",
        },
      ]),
    );
  });
});
