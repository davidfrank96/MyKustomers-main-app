import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "./support/test";
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
const requiredViewports = [320, 360, 375, 390, 430, 768, 1024, 1440] as const;
const screenshotWidths = new Set([320, 390, 768, 1024]);
const screenshotDirectory = path.resolve("test-results/edit-booking-panel");

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `edit-booking-admin-${randomUUID()}`,
      },
    },
  );
}

async function expectNoPageOverflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `Edit booking overflowed at ${width}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function hideDevelopmentChrome(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
  });
}

test.describe("edit booking presentation", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("preserves edit behavior across the responsive visual matrix", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "One browser matrix is sufficient.");
    test.setTimeout(180_000);

    const admin = adminClient();
    const fixture = randomUUID().slice(0, 8);
    const email = `edit-booking-${Date.now()}-${fixture}@example.com`;
    const password = `Edit-Booking-${randomUUID()}-A1`;
    let userId: string | null = null;
    let businessId: string | null = null;
    let customerId: string | null = null;
    let bookingId: string | null = null;

    try {
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Edit Booking Owner" },
      });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const { data: business, error: businessError } = await admin
        .from("businesses")
        .insert({
          name: "Edit Booking Studio",
          slug: `edit-booking-${fixture}`,
          category: "Professional Services",
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
          name: "Vivian Pedro",
          email: `customer-${fixture}@example.com`,
        })
        .select("id")
        .single();
      expect(customerError).toBeNull();
      customerId = customer!.id;

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title: "Macbook pro",
          description: "Buying her a new laptop",
          currency: "NGN",
          total_amount_minor: 5_000_000,
          deposit_amount_minor: 3_000_000,
          status: "DRAFT",
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Private business note",
          created_by: userId,
        })
        .select("id")
        .single();
      expect(bookingError).toBeNull();
      bookingId = booking!.id;

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto(`/bookings/${bookingId}`);
      await expect(page.getByRole("heading", { name: "Macbook pro" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const section = page.locator("#booking-details");
      const trigger = section.locator("h2 > button");
      if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel("Booking title")).toHaveValue("Macbook pro");
      await expect(page.getByLabel("Internal notes")).toHaveValue(
        "Private business note",
      );
      await page.addStyleTag({
        content: `
          header { position: relative !important; }
          nav[aria-label="Mobile vendor navigation"] { position: static !important; }
        `,
      });
      await hideDevelopmentChrome(page);

      fs.mkdirSync(screenshotDirectory, { recursive: true });
      for (const width of requiredViewports) {
        await page.setViewportSize({ width, height: width <= 430 ? 900 : 1024 });
        await expectNoPageOverflow(page, width);
        await expect(page.getByRole("button", { name: "Save booking" })).toBeVisible();
        if (screenshotWidths.has(width)) {
          await section.screenshot({
            path: path.join(screenshotDirectory, `edit-booking-expanded-${width}.png`),
            animations: "disabled",
          });
        }
      }

      await page.setViewportSize({ width: 390, height: 900 });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await section.screenshot({
        path: path.join(screenshotDirectory, "edit-booking-collapsed-390.png"),
        animations: "disabled",
      });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      await page.getByLabel("Booking title").fill("");
      await page.getByRole("button", { name: "Save booking" }).click();
      await expect(page.getByText("Booking title is required.")).toBeVisible();
      await expect(page.getByLabel("Booking title")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await hideDevelopmentChrome(page);
      await section.screenshot({
        path: path.join(screenshotDirectory, "edit-booking-validation-390.png"),
        animations: "disabled",
      });
    } finally {
      if (bookingId) {
        await admin.from("booking_status_history").delete().eq("booking_id", bookingId);
        await admin.from("bookings").delete().eq("id", bookingId);
      }
      if (customerId) await admin.from("customers").delete().eq("id", customerId);
      if (businessId) {
        await admin.from("audit_logs").delete().eq("business_id", businessId);
        await admin.from("business_members").delete().eq("business_id", businessId);
        await admin.from("businesses").delete().eq("id", businessId);
      }
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
