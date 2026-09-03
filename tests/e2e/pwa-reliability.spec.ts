import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./support/test";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
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

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `pwa-reliability-${randomUUID()}`,
      },
    },
  );
}

async function createControlledUser(
  service: ReturnType<typeof serviceClient>,
  credentials: { email: string; password: string },
) {
  const created = await service.auth.admin.createUser({
    ...credentials,
    email_confirm: true,
    user_metadata: { display_name: "PWA Reliability E2E" },
  });
  if (created.data.user) return created.data.user;

  // A failed Admin response can be ambiguous. Resolve the unique test email
  // before making one bounded retry so cleanup never loses a created user.
  const existing = await service.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  const existingUser = existing.data.users.find(
    (user) => user.email === credentials.email,
  );
  if (existingUser) return existingUser;

  await new Promise((resolve) => setTimeout(resolve, 750));
  const retried = await service.auth.admin.createUser({
    ...credentials,
    email_confirm: true,
    user_metadata: { display_name: "PWA Reliability E2E" },
  });
  expect(retried.error).toBeNull();
  return retried.data.user!;
}

async function cleanupControlledFixture(
  service: ReturnType<typeof serviceClient>,
  businessIds: string[],
  userId: string | null,
) {
  const failures: string[] = [];

  if (businessIds.length > 0) {
    for (const table of [
      "bookings",
      "customers",
      "audit_logs",
      "business_members",
    ] as const) {
      const result = await service.from(table).delete().in("business_id", businessIds);
      if (result.error) failures.push(`${table}: ${result.error.message}`);
    }

    const businesses = await service.from("businesses").delete().in("id", businessIds);
    if (businesses.error) failures.push(`businesses: ${businesses.error.message}`);
  }

  if (userId) {
    const user = await service.auth.admin.deleteUser(userId);
    if (user.error) failures.push(`auth user: ${user.error.message}`);
  }

  if (failures.length > 0)
    throw new Error(`PWA fixture cleanup failed: ${failures.join("; ")}`);
}

async function meaningfulResume(page: import("@playwright/test").Page) {
  const coordinator = page.locator("[data-pwa-reliability-coordinator]");
  await expect(coordinator).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(coordinator).toHaveAttribute(
    "data-reconcile-path",
    new URL(page.url()).pathname,
  );
  await page.evaluate(() => {
    const originalNow = Date.now;
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    let now = originalNow();
    Date.now = () => now;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    now += 30_000;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Date.now = originalNow;
    if (originalVisibility)
      Object.defineProperty(document, "visibilityState", originalVisibility);
    else {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
    }
  });
}

test.describe("authenticated PWA reliability", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("reconciles authoritative state without private caching or unsafe offline replay", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const service = serviceClient();
    const fixture = `${testInfo.project.name}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `pwa-reliability-${fixture}@example.com`;
    const password = `Pwa-${randomUUID()}-A1!`;
    const businessIds: string[] = [];
    let userId: string | null = null;

    try {
      const user = await createControlledUser(service, { email, password });
      userId = user.id;

      const businesses: Array<{ id: string; name: string }> = [];
      for (const label of ["Alpha", "Beta"]) {
        const { data, error } = await service
          .from("businesses")
          .insert({
            name: `PWA ${label} ${fixture}`,
            slug: `pwa-${label.toLowerCase()}-${fixture}`,
            category: "Other",
            created_by: userId,
            onboarding_completed_at: new Date().toISOString(),
          })
          .select("id, name")
          .single();
        expect(error).toBeNull();
        businesses.push(data!);
        businessIds.push(data!.id);
      }

      const { error: membershipError } = await service.from("business_members").insert(
        businesses.map((business) => ({
          business_id: business.id,
          user_id: userId,
          role: "owner",
          status: "active",
        })),
      );
      expect(membershipError).toBeNull();

      const customers: Array<{ id: string; name: string }> = [];
      const bookings: Array<{ id: string; title: string }> = [];
      for (const [index, business] of businesses.entries()) {
        const customerName = `PWA Customer ${index + 1} ${fixture}`;
        const { data: customer, error: customerError } = await service
          .from("customers")
          .insert({ business_id: business.id, name: customerName })
          .select("id, name")
          .single();
        expect(customerError).toBeNull();
        customers.push(customer!);

        const bookingTitle = `PWA Booking ${index + 1} ${fixture}`;
        const { data: booking, error: bookingError } = await service
          .from("bookings")
          .insert({
            business_id: business.id,
            customer_id: customer!.id,
            title: bookingTitle,
            currency: "EUR",
            total_amount_minor: 15_000,
            deposit_amount_minor: 0,
            created_by: userId,
          })
          .select("id, title")
          .single();
        expect(bookingError).toBeNull();
        bookings.push(booking!);
      }

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      expect(context.serviceWorkers()).toHaveLength(0);

      const switcher = page.getByRole("button", {
        name: /Switch business\. Current business:/,
      });
      const switcherLabel = await switcher.getAttribute("aria-label");
      const currentIndex = businesses.findIndex((business) =>
        switcherLabel?.includes(business.name),
      );
      expect(currentIndex).toBeGreaterThanOrEqual(0);
      const currentBooking = bookings[currentIndex];
      const currentCustomer = customers[currentIndex];
      const otherIndex = currentIndex === 0 ? 1 : 0;

      const bookingsLink = page.getByRole("link", { name: "Bookings", exact: true });
      await bookingsLink.click();
      await expect(
        page.getByRole("heading", { name: "Bookings", exact: true }),
      ).toBeVisible();
      await page.locator(`a[href="/bookings/${currentBooking.id}"]`).click();
      await expect(
        page.getByRole("heading", { name: currentBooking.title }),
      ).toBeVisible();
      await expect(page.locator("[data-pwa-booking-sync]")).toHaveAttribute(
        "data-ready",
        "true",
      );
      const { error: paymentError } = await service.from("booking_payments").insert({
        business_id: businesses[currentIndex].id,
        booking_id: currentBooking.id,
        operation_id: randomUUID(),
        amount_minor: 1_000,
        recorded_by: userId,
      });
      expect(paymentError).toBeNull();
      await meaningfulResume(page);
      await expect(page.getByText(/140 outstanding/)).toBeVisible();
      await page.waitForTimeout(1_200);
      await page.goBack();
      await expect(page).toHaveURL(/\/bookings$/);
      await expect(
        page.getByRole("heading", { name: "Bookings", exact: true }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Customers", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Customers", exact: true }),
      ).toBeVisible();
      const updatedCustomerName = `${currentCustomer.name} refreshed`;
      const { error: updateError } = await service
        .from("customers")
        .update({ name: updatedCustomerName })
        .eq("id", currentCustomer.id);
      expect(updateError).toBeNull();
      await meaningfulResume(page);
      await expect(page.getByText(updatedCustomerName, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("[data-pwa-reliability-status]")).toHaveCount(0);

      await page.goto("/bookings/new");
      const title = page.getByLabel("Title");
      await title.fill("Unsaved booking survives resume");
      await title.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      const titleBox = await title.boundingBox();
      expect(titleBox).not.toBeNull();
      if (testInfo.project.name !== "pwa-chromium") {
        const mobileNavBox = await page
          .getByRole("navigation", { name: "Mobile vendor navigation" })
          .boundingBox();
        expect(mobileNavBox).not.toBeNull();
        expect((titleBox?.y ?? 0) + (titleBox?.height ?? 0)).toBeLessThanOrEqual(
          mobileNavBox?.y ?? 0,
        );
      }
      await meaningfulResume(page);
      await expect(title).toHaveValue("Unsaved booking survives resume");
      await expect(page.getByText(/Finish or close the current form/)).toBeVisible();

      await page.goto("/dashboard");
      await context.setOffline(true);
      await expect(page.getByText("You're offline.", { exact: false })).toBeVisible();
      await page.getByRole("link", { name: "Bookings", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page).toHaveURL(/\/bookings$/);
      await expect(
        page.getByRole("heading", { name: "Bookings", exact: true }),
      ).toBeVisible();

      await page.goto("/dashboard");
      await page
        .getByRole("button", {
          name: new RegExp(`Current business: ${businesses[currentIndex].name}`),
        })
        .click();
      await page
        .getByRole("menuitem", { name: new RegExp(businesses[otherIndex].name) })
        .click();
      await expect(
        page.getByRole("button", {
          name: new RegExp(`Current business: ${businesses[otherIndex].name}`),
        }),
      ).toBeVisible();
      await page.goto("/customers");
      await expect(
        page.getByText(customers[otherIndex].name, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(updatedCustomerName, { exact: true })).toHaveCount(0);
      await meaningfulResume(page);
      await expect(
        page.getByText(customers[otherIndex].name, { exact: true }),
      ).toBeVisible();
      await expect(page.locator("[data-pwa-reliability-status]")).toHaveCount(0);

      await page.goto("/business");
      const businessInformation = page.getByRole("button", {
        name: /Business information/,
      });
      if ((await businessInformation.getAttribute("aria-expanded")) !== "true") {
        await businessInformation.click();
      }
      await expect(businessInformation).toHaveAttribute("aria-expanded", "true");
      await page.waitForTimeout(500);
      const logoSettings = page.getByRole("region", {
        name: "Business logo settings",
      });
      const cancelChooserPromise = page.waitForEvent("filechooser");
      await logoSettings.getByText("Choose image", { exact: true }).click();
      const cancelChooser = await cancelChooserPromise;
      await cancelChooser.setFiles([]);
      await expect(logoSettings.getByText("Choose image", { exact: true })).toBeVisible();

      const unsupportedChooserPromise = page.waitForEvent("filechooser");
      await logoSettings.getByText("Choose image", { exact: true }).click();
      const unsupportedChooser = await unsupportedChooserPromise;
      await unsupportedChooser.setFiles({
        name: "iphone-photo.heic",
        mimeType: "image/heic",
        buffer: Buffer.from("unsupported-heic"),
      });
      await expect(page.getByText("Choose a PNG, JPEG, or WebP logo.")).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      if (testInfo.project.name !== "pwa-chromium") {
        const nav = page.getByRole("navigation", { name: "Mobile vendor navigation" });
        const box = await nav.boundingBox();
        expect(box).not.toBeNull();
        expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(
          page.viewportSize()?.height,
        );
      }

      await page.goto("/dashboard");
      await context.clearCookies();
      await meaningfulResume(page);
      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    } finally {
      await cleanupControlledFixture(service, businessIds, userId);
    }
  });
});
