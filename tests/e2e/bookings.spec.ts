import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { hashRateLimitIdentity } from "../../features/confirmation-links/rate-limit-keys";
import { hashConfirmationToken } from "../../features/confirmation-links/token";
import { hashAddonToken } from "../../features/addons/token";

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

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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
    return { businessId: business!.id, customerId: null };
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

  return { businessId: business!.id, customerId: customer!.id };
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
          await admin.from("email_events").delete().in("booking_id", bookingIds);
          await admin
            .from("booking_addon_confirmation_links")
            .delete()
            .in("booking_id", bookingIds);
          await admin.from("booking_addons").delete().in("booking_id", bookingIds);
          await admin.from("booking_issues").delete().in("booking_id", bookingIds);
          await admin.from("feedback").delete().in("booking_id", bookingIds);
          await admin.from("feedback_links").delete().in("booking_id", bookingIds);
          await admin.from("booking_confirmations").delete().in("booking_id", bookingIds);
          await admin.from("confirmation_links").delete().in("booking_id", bookingIds);
          await admin
            .from("booking_status_history")
            .delete()
            .in("booking_id", bookingIds);
          await admin.from("booking_changes").delete().in("booking_id", bookingIds);
        }

        await admin.from("bookings").delete().in("business_id", businessIds);
        await admin.from("customers").delete().in("business_id", businessIds);
        await admin.from("audit_logs").delete().in("business_id", businessIds);
        await admin.storage
          .from("business-logos")
          .remove(businessIds.map((businessId) => `${businessId}/logo.webp`));
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

  test("canonical customer, booking, confirmation, fulfilment, feedback, and insights journey", async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const email = testEmail(testInfo.project.name);
    const password = `Phase5-E2E-${randomUUID()}-A1`;
    const slug = `phase5-e2e-bookings-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
    await page.getByLabel("Password").fill(password);
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
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Created through Phase 5 E2E.");
    await page.getByLabel("Scheduled date").fill(futureLocalDateTime());
    await page.getByLabel("Agreed total").fill("45000");
    await page.getByLabel("Deposit recorded").fill("5000");
    await page.getByLabel("Internal notes").fill("Private E2E note.");
    await page.getByRole("button", { name: "Create booking" }).click();

    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1/, {
      timeout: 15_000,
    });
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
    await expect(generatedLinkInput).toBeAttached({ timeout: 15_000 });
    const confirmationUrl = await generatedLinkInput.inputValue();
    expect(confirmationUrl).toContain("/c/");
    await expect(
      page.locator("span").filter({ hasText: /^Awaiting customer$/ }),
    ).toBeVisible();

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

    await page.goto(confirmationUrl);
    await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Review your order with Phase 5 E2E Business",
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "Phase 5 E2E Business has sent you an order for review and confirmation.",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      confirmationUrl,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "website",
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "My Customers",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /business-logos/,
    );
    await expect(page.getByText("Phase 5 E2E Business", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Phase 5 E2E Business logo").locator("img"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Visit website" })).toHaveAttribute(
      "href",
      "https://phase5.example.com/booking",
    );
    await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/phase5business/",
    );
    await expect(page.getByText(ownerFixture.businessId)).toHaveCount(0);
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText("₦45,000")).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);

    await page
      .getByLabel("Where should we send updates about this booking?")
      .fill("customer-confirmation@example.com");
    await page.getByLabel("Phone number (optional)").fill("+353 01 555 0155");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/confirmed=1/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(
      page.getByText("We'll send a confirmation to c***@example.com."),
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

    await page.goto(confirmationUrl);
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(
      page
        .locator("span")
        .filter({ hasText: /^Confirmed$/ })
        .first(),
    ).toBeVisible();
    await expect(page.getByText("customer-confirmation@example.com")).toBeVisible();
    await expect(page.getByText("sent", { exact: true })).toBeVisible();
    await expect(page.getByText(/Copy link selected/)).toBeVisible();
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
    await page.reload();
    await expect(
      page.getByText("First viewed").locator("..").getByText("Not available"),
    ).toHaveCount(0);

    await page.goto(`/customers/${fixture.customerId}`);
    await expect(page.getByLabel("Email")).toHaveValue(
      "customer-confirmation@example.com",
    );
    await expect(page.getByLabel("Phone")).toHaveValue("+353 01 555 0155");
    await page.goto(bookingDetailUrl);

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
    const amendmentLinkInput = page.getByLabel("Generated amendment link");
    await expect(amendmentLinkInput).toBeAttached();
    const amendmentUrl = await amendmentLinkInput.inputValue();
    expect(amendmentUrl).toContain("/a/");
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
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
    await expect(page.getByText("₦55,000").first()).toBeVisible();
    await expect(page.getByText("Booking amendment proposed")).toBeVisible();
    await expect(page.getByText("Booking amendment confirmed")).toBeVisible();
    await expect(page.getByLabel("Booking title")).toBeDisabled();

    const { data: originalConfirmationBeforeAddon } = await admin
      .from("booking_confirmations")
      .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
      .eq("booking_id", new URL(bookingDetailUrl).pathname.split("/").at(-1) ?? "")
      .single();

    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("heading", { name: "Add item" })).toBeVisible();
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
    await page.getByRole("button", { name: "Send for confirmation" }).click();
    await expect(page.getByText("Add-on is awaiting customer confirmation.")).toBeVisible(
      {
        timeout: serverActionTimeout,
      },
    );
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
    await expect(page.getByText("Booking add-on confirmed")).toBeVisible();
    await expect(page.getByText("₦73,000").first()).toBeVisible();
    await expect(page.getByText("₦12,000").first()).toBeVisible();
    await expect(page.getByText("₦61,000").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel add-on" })).toHaveCount(0);

    await page.getByLabel("New scheduled date").fill(futureLocalDateTimePlus(2));
    await page.getByRole("button", { name: "Reschedule" }).click();
    await expect(
      page.getByText("Booking rescheduled. Customer confirmation is required again."),
    ).toBeVisible({ timeout: serverActionTimeout });
    await expect(
      page.locator("span").filter({ hasText: /^Awaiting customer$/ }),
    ).toBeVisible();
    await expect(page.getByText("Booking rescheduled", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: /Generate confirmation link|Regenerate link/ })
      .click();
    const regeneratedLinkInput = page.getByLabel("Generated confirmation link");
    await expect(regeneratedLinkInput).toBeAttached({ timeout: 15_000 });
    const regeneratedConfirmationUrl = await regeneratedLinkInput.inputValue();
    expect(regeneratedConfirmationUrl).toContain("/c/");

    await page.goto(regeneratedConfirmationUrl);
    await page
      .getByLabel("Where should we send updates about this booking?")
      .fill("customer-confirmation@example.com");
    await page.getByLabel("Phone number (optional)").fill("+353 01 555 0155");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(
      page
        .locator("span")
        .filter({ hasText: /^Confirmed$/ })
        .first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start work" }).click();
    await expect(page).toHaveURL(/message=status-updated/);
    await expect(page.locator("span").filter({ hasText: /^In progress$/ })).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("Confirmed to In progress")).toBeVisible();

    await page.getByRole("button", { name: "Mark ready" }).click();
    await expect(page.locator("span").filter({ hasText: /^Ready$/ })).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("In progress to Ready")).toBeVisible();

    await page.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.locator("span").filter({ hasText: /^Delivered$/ })).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("Ready to Delivered")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete booking" }).click();
    await expect(page.locator("span").filter({ hasText: /^Completed$/ })).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(page.getByText("Delivered to Completed")).toBeVisible();
    await expect(
      page.getByText("Completed and cancelled bookings are locked."),
    ).toBeVisible();

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
    await expect(page.getByText(amendedTitle)).toBeVisible();
    await expect(page.getByText("Updated private E2E note.")).toHaveCount(0);
    await expect(page.getByText("Balance remaining")).toHaveCount(0);

    await page.locator('input[name="overallRating"][value="5"]').check();
    await page.locator('input[name="onTime"][value="yes"]').check();
    await page.locator('input[name="metExpectations"][value="yes"]').check();
    await page
      .getByLabel("What could we do better?")
      .fill("Everything was handled privately.");
    await page.getByRole("button", { name: "Submit private feedback" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    await expect(
      page.getByRole("heading", { name: "Thank you for your feedback" }),
    ).toBeVisible();
    await expect(page.getByText("It is not posted publicly.")).toBeVisible();

    await page.goto(bookingDetailUrl);
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText("Everything was handled privately.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request feedback" })).toHaveCount(0);

    await page.getByLabel("Category").selectOption("LATE_DELIVERY");
    await page
      .getByLabel("Issue description")
      .fill("Delivery finished after the agreed time.");
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByText("Issue created.")).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Late delivery" })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Open$/ })).toBeVisible();

    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page).toHaveURL(/message=issue-resolved/);
    await expect(page.getByText("Issue resolved.")).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Resolved$/ })).toBeVisible();

    await page.goto("/insights?range=this_month");
    await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
    await expect(page.getByText("Private business insights")).toBeVisible();
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
    test.skip(testInfo.project.name !== "chromium", "The explicit viewport matrix runs once.");
    test.setTimeout(90_000);

    const email = testEmail(testInfo.project.name);
    const password = `Phase5-Search-${randomUUID()}-A1`;
    const suffix = randomUUID().slice(0, 8);
    const slug = `phase5-search-${Date.now()}-${suffix}`;
    const customerName = `Search Customer Sarah ${suffix}`;
    const bookingTitle = `Search Booking Sarah ${suffix}`;
    createdBusinessSlugs.add(slug);
    await createConfirmedBusinessOwner({
      email,
      password,
      slug,
      customerName,
      customerEmail: `search-${suffix}@example.com`,
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Preserve this while customer search updates.");
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
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe(bookingTitle);
    expect(new URL(page.url()).searchParams.get("filter")).toBe("active");
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await expect(page.getByRole("link", { name: new RegExp(bookingTitle) })).toBeVisible();

    await page.getByRole("link", { name: "Draft", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("DRAFT");
    expect(new URL(page.url()).searchParams.get("q")).toBe(bookingTitle);
    await expect(page.getByRole("link", { name: new RegExp(bookingTitle) })).toBeVisible();

    await page.getByLabel("Search bookings").fill(`No match ${suffix}`);
    await expect(page.getByText("No saved bookings matched this search.")).toBeVisible();
    await page.getByRole("button", { name: "Clear booking search" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    expect(new URL(page.url()).searchParams.get("filter")).toBe("DRAFT");
    await expect(page.getByRole("link", { name: new RegExp(bookingTitle) })).toBeVisible();

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
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.getByRole("button", { name: "Add new customer" }).click();
    await page.getByLabel("Customer name").fill(inlineCustomerName);
    await page.getByLabel("Email", { exact: true }).fill(duplicateEmail.toUpperCase());
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Scheduled date").fill(futureLocalDateTime());
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
    const userAgent = (await page.evaluate(() => navigator.userAgent)).slice(0, 80);
    createdRateLimitBuckets.add(hashRateLimitIdentity(`lookup:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`confirm:unknown:${userAgent}`));

    await page.goto(confirmationUrl);
    await expect(page.getByLabel("Phase 5 E2E Business logo")).toBeVisible();
    await expect(page.getByLabel("Phase 5 E2E Business logo").locator("img")).toHaveCount(
      0,
    );
    await page
      .getByLabel("Where should we send updates about this booking?")
      .fill(duplicateEmail);
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
    test.setTimeout(120_000);

    const email = testEmail(`${testInfo.project.name}-cancellation`);
    const password = `Cancellation-E2E-${randomUUID()}-A1`;
    const slug = `cancellation-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const customerName = `Cancellation Customer ${randomUUID().slice(0, 8)}`;
    const bookingTitle = `Cancellation Booking ${randomUUID().slice(0, 8)}`;
    const staleCustomerEmail = `old-${randomUUID().slice(0, 8)}@example.com`;
    const confirmationEmail = `new-${randomUUID().slice(0, 8)}@example.com`;
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
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/bookings/new");
    await page.locator("#customerId").click();
    await page.locator('[role="option"]').filter({ hasText: customerName }).click();
    await page.getByLabel("Booking title").fill(bookingTitle);
    await page.getByLabel("Description").fill("Customer-confirmed cancellation E2E.");
    await page.getByLabel("Scheduled date").fill(futureLocalDateTime());
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
    createdRateLimitBuckets.add(hashRateLimitIdentity(`lookup:unknown:${userAgent}`));
    createdRateLimitBuckets.add(hashRateLimitIdentity(`confirm:unknown:${userAgent}`));

    await page.goto(confirmationUrl);
    await page
      .getByLabel("Where should we send updates about this booking?")
      .fill(confirmationEmail);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(bookingUrl);
    await expect(page.locator("span").filter({ hasText: /^Confirmed$/ })).toBeVisible();
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

    const reasonInput = page.getByLabel("Cancellation reason");
    await expect(reasonInput).toHaveAttribute("required", "");
    await reasonInput.fill(cancellationReason);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.locator("span").filter({ hasText: /^Cancelled$/ })).toBeVisible({
      timeout: serverActionTimeout,
    });
    await expect(
      page.getByText(`Cancellation reason: ${cancellationReason}`),
    ).toBeVisible();
    await expect(page.getByText("Confirmed to Cancelled")).toBeVisible();
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
  });
});
