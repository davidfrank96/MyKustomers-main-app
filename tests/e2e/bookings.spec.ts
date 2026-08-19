import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hashRateLimitIdentity } from "../../features/confirmation-links/rate-limit-keys";

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
const createdRateLimitBuckets = new Set<string>();
const testRunStartedAt = new Date().toISOString();

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

function testEmail(projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `phase5-e2e-bookings-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
  createdEmails.add(email);
  return email;
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

async function createConfirmedBusinessOwnerWithCustomer({
  email,
  password,
  slug,
  customerName,
}: {
  email: string;
  password: string;
  slug: string;
  customerName: string;
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

  const { error: customerError } = await admin.from("customers").insert({
    business_id: business!.id,
    name: customerName,
    email: "phase5-booking-customer@example.com",
    phone: "+353 01 555 0155",
  });
  expect(customerError).toBeNull();
}

test.describe("booking engine", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test.afterAll(async () => {
    const admin = createAdminClient();

    if (createdRateLimitBuckets.size > 0) {
      await admin
        .from("confirmation_rate_limits")
        .delete()
        .in("bucket_key", [...createdRateLimitBuckets]);
    }

    await admin
      .from("confirmation_rate_limits")
      .delete()
      .gte("updated_at", testRunStartedAt);

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
          await admin.from("booking_confirmations").delete().in("booking_id", bookingIds);
          await admin.from("confirmation_links").delete().in("booking_id", bookingIds);
          await admin.from("booking_status_history").delete().in("booking_id", bookingIds);
          await admin.from("booking_changes").delete().in("booking_id", bookingIds);
        }

        await admin.from("bookings").delete().in("business_id", businessIds);
        await admin.from("customers").delete().in("business_id", businessIds);
        await admin.from("audit_logs").delete().in("business_id", businessIds);
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

  test("business user can create, confirm, reschedule, and complete a booking", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    const email = testEmail(testInfo.project.name);
    const password = `Phase5-E2E-${randomUUID()}-A1`;
    const slug = `phase5-e2e-bookings-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const customerName = `Phase 5 Customer ${randomUUID().slice(0, 8)}`;
    const bookingTitle = `Phase 5 Booking ${randomUUID().slice(0, 8)}`;
    const updatedTitle = `${bookingTitle} Updated`;
    createdBusinessSlugs.add(slug);

    await createConfirmedBusinessOwnerWithCustomer({
      email,
      password,
      slug,
      customerName,
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "Bookings", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "New booking" }).first().click();
    await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();

    await page.locator("#customerId").click();
    await page.locator('[role="option"]').filter({ hasText: customerName }).click();
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Created through Phase 5 E2E.");
    await page.getByLabel("Scheduled date").fill(futureLocalDateTime());
    await page.getByLabel("Agreed total").fill("45000");
    await page.getByLabel("Deposit recorded").fill("5000");
    await page.getByLabel("Internal notes").fill("Private E2E note.");
    await page.getByRole("button", { name: "Create booking" }).click();

    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/);
    await expect(page.getByRole("heading", { name: bookingTitle })).toBeVisible();
    await expect(page.getByText(/MC-[0-9]{6}-[A-F0-9]{6}/)).toBeVisible();
    await expect(page.getByText("Booking created.")).toBeVisible();

    await page.getByLabel("Booking title").fill(updatedTitle);
    await page.getByLabel("Internal notes").fill("Updated private E2E note.");
    await page.getByRole("button", { name: "Save booking" }).click();
    await expect(page.getByText("Booking updated.")).toBeVisible();
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    const bookingDetailUrl = page.url();
    await page.getByRole("button", { name: "Generate confirmation link" }).click();
    const generatedLinkInput = page.getByLabel("Generated confirmation link");
    await expect(generatedLinkInput).toBeVisible();
    const confirmationUrl = await generatedLinkInput.inputValue();
    expect(confirmationUrl).toContain("/c/");
    await expect(page.locator("span").filter({ hasText: /^Awaiting Customer$/ })).toBeVisible();

    const userAgent = (await page.evaluate(() => navigator.userAgent)).slice(0, 80);
    createdRateLimitBuckets.add(hashRateLimitIdentity(`lookup:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`confirm:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`feedback_lookup:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`feedback_submit:unknown:${userAgent}`));

    await page.goto(confirmationUrl);
    await expect(page.getByRole("heading", { name: "Confirm booking" })).toBeVisible();
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);

    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/confirmed=1/);
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(confirmationUrl);
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(page.locator("span").filter({ hasText: /^Confirmed$/ })).toBeVisible();

    await page.getByLabel("New scheduled date").fill(futureLocalDateTimePlus(2));
    await page.getByRole("button", { name: "Reschedule" }).click();
    await expect(
      page.getByText("Booking rescheduled. Customer confirmation is required again."),
    ).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Awaiting Customer$/ })).toBeVisible();
    await expect(page.getByText("Booking rescheduled", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Generate confirmation link|Regenerate link/ }).click();
    const regeneratedLinkInput = page.getByLabel("Generated confirmation link");
    await expect(regeneratedLinkInput).toBeVisible();
    const regeneratedConfirmationUrl = await regeneratedLinkInput.inputValue();
    expect(regeneratedConfirmationUrl).toContain("/c/");

    await page.goto(regeneratedConfirmationUrl);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(page.locator("span").filter({ hasText: /^Confirmed$/ })).toBeVisible();

    await page.getByRole("button", { name: "Start work" }).click();
    await expect(page).toHaveURL(/message=status-updated/);
    await expect(page.locator("span").filter({ hasText: /^In Progress$/ })).toBeVisible();
    await expect(page.getByText("Confirmed to In Progress")).toBeVisible();

    await page.getByRole("button", { name: "Mark ready" }).click();
    await expect(page.locator("span").filter({ hasText: /^Ready$/ })).toBeVisible();
    await expect(page.getByText("In Progress to Ready")).toBeVisible();

    await page.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.locator("span").filter({ hasText: /^Delivered$/ })).toBeVisible();
    await expect(page.getByText("Ready to Delivered")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete booking" }).click();
    await expect(page.locator("span").filter({ hasText: /^Completed$/ })).toBeVisible();
    await expect(page.getByText("Delivered to Completed")).toBeVisible();
    await expect(page.getByText("Completed and cancelled bookings are locked.")).toBeVisible();

    await page.getByRole("button", { name: "Request feedback" }).click();
    const feedbackLinkInput = page.getByLabel("Generated feedback link");
    await expect(feedbackLinkInput).toBeVisible();
    const feedbackUrl = await feedbackLinkInput.inputValue();
    expect(feedbackUrl).toContain("/f/");

    const feedbackResponse = await page.goto(feedbackUrl);
    expect(feedbackResponse?.headers()["cache-control"]).toContain("no-store");
    expect(feedbackResponse?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(feedbackResponse?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { name: "Private feedback" })).toBeVisible();
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);
    await expect(page.getByText("Balance remaining")).toHaveCount(0);

    await page.locator('input[name="overallRating"][value="5"]').check();
    await page.locator('input[name="onTime"][value="yes"]').check();
    await page.locator('input[name="metExpectations"][value="yes"]').check();
    await page.getByLabel("What could we do better?").fill("Everything was handled privately.");
    await page.getByRole("button", { name: "Submit private feedback" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
    await expect(page.getByText("It is not posted publicly.")).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText("Everything was handled privately.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request feedback" })).toHaveCount(0);

    await page.getByLabel("Category").selectOption("LATE_DELIVERY");
    await page.getByLabel("Issue description").fill("Delivery finished after the agreed time.");
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByText("Issue created.")).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Late delivery" })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Open$/ })).toBeVisible();

    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page).toHaveURL(/message=issue-resolved/);
    await expect(page.getByText("Issue resolved.")).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Resolved$/ })).toBeVisible();
  });
});
