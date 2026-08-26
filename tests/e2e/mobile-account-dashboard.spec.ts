import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  MAX_BUSINESS_LOGO_SOURCE_BYTES,
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
} from "../../features/businesses/logo-policy";
import {
  createCameraLogoJpeg,
  installBusinessLogoTransportObserver,
  readObservedBusinessLogoTransportBytes,
} from "./support/business-logo-fixtures";

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

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `mobile-account-admin-${randomUUID()}`,
      },
    },
  );
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function downloadStoredLogo(
  admin: ReturnType<typeof adminClient>,
  businessId: string,
) {
  const path = `${businessId}/logo.webp`;
  const {
    data: { publicUrl },
  } = admin.storage.from("business-logos").getPublicUrl(path);
  const response = await fetch(`${publicUrl}?v=${randomUUID()}`, { cache: "no-store" });
  expect(response.ok).toBe(true);
  expect(response.headers.get("content-type")).toContain("image/webp");
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBeLessThanOrEqual(512);
  expect(metadata.height).toBeLessThanOrEqual(512);
  expect(buffer.byteLength).toBeLessThanOrEqual(200 * 1024);

  const { data: objects, error: listError } = await admin.storage
    .from("business-logos")
    .list(businessId);
  expect(listError).toBeNull();
  expect(objects?.map((object) => object.name)).toEqual(["logo.webp"]);

  return buffer;
}

test.describe("mobile account and dashboard navigation", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("mobile account access, dashboard links, responsive forms, and logout work", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Explicit viewport matrix runs once.");
    test.setTimeout(120_000);

    const admin = adminClient();
    const email = `mobile-account-${Date.now()}-${randomUUID()}@example.com`;
    const password = `Mobile-Account-${randomUUID()}-A1`;
    const slug = `mobile-account-${randomUUID().slice(0, 8)}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Mobile Account Owner" },
    });
    expect(userError).toBeNull();

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .insert({
        name: "Mobile Account Business",
        slug,
        category: "Other",
        created_by: userData.user!.id,
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(businessError).toBeNull();
    const { error: membershipError } = await admin.from("business_members").insert({
      business_id: business!.id,
      user_id: userData.user!.id,
      role: "owner",
      status: "active",
    });
    expect(membershipError).toBeNull();

    try {
      await installBusinessLogoTransportObserver(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const mobileNavigation = page.getByRole("navigation", {
        name: "Mobile vendor navigation",
      });
      await expect(mobileNavigation.getByRole("link")).toHaveCount(5);
      await expect(mobileNavigation.getByRole("link", { name: "Settings" })).toHaveCount(0);

      await page.getByRole("button", { name: "Open account menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
      await page.getByRole("menuitem", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
        for (const route of ["/settings", "/business", "/dashboard"]) {
          await page.goto(route);
          await expectNoOverflow(page);
        }
        await expect(page.getByRole("link", { name: "View active bookings" })).toBeVisible();
      }

      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/business");
      const pngLogo = await sharp({
        create: {
          width: 900,
          height: 450,
          channels: 4,
          background: { r: 25, g: 105, b: 83, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      await page.getByLabel("Logo image").setInputFiles({
        name: "mobile-logo.png",
        mimeType: "image/png",
        buffer: pngLogo,
      });
      await page.getByRole("button", { name: "Upload logo" }).click();
      await expect(page.getByText("Business logo uploaded.")).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: "Business logo settings" })
          .getByLabel("Mobile Account Business logo")
          .locator("img"),
      ).toBeVisible();
      const firstStoredLogo = await downloadStoredLogo(admin, business!.id);

      await page.setViewportSize({ width: 390, height: 844 });
      let replacementRequests = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes(`/api/businesses/${business!.id}/logo`)
        ) {
          replacementRequests += 1;
        }
      });
      const oversizedLogo = await createCameraLogoJpeg(
        MAX_BUSINESS_LOGO_SOURCE_BYTES + 1,
      );
      await page.getByLabel("Logo image").setInputFiles({
        name: "oversized-phone-logo.jpg",
        mimeType: "image/jpeg",
        buffer: oversizedLogo,
      });
      await expect(page.getByText("Logo image must be 5 MB or smaller.")).toBeVisible();
      await page.waitForTimeout(200);
      expect(replacementRequests).toBe(0);

      const jpegLogo = await createCameraLogoJpeg(Math.floor(4.8 * 1024 * 1024));
      const replacementRequestPromise = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes(`/api/businesses/${business!.id}/logo`),
      );
      await page.getByLabel("Logo image").setInputFiles({
        name: "replacement-phone-logo.jpg",
        mimeType: "image/jpeg",
        buffer: jpegLogo,
      });
      await page.getByRole("button", { name: "Replace logo" }).click();
      await replacementRequestPromise;
      const requestBodySize = await readObservedBusinessLogoTransportBytes(page);
      expect(requestBodySize).not.toBeNull();
      expect(requestBodySize).toBeGreaterThan(0);
      expect(requestBodySize!).toBeLessThanOrEqual(
        MAX_BUSINESS_LOGO_TRANSPORT_BYTES + 64 * 1024,
      );
      expect(replacementRequests).toBe(1);
      await expect(page.getByText("Business logo replaced.")).toBeVisible();
      const replacementStoredLogo = await downloadStoredLogo(admin, business!.id);
      expect(replacementStoredLogo.equals(firstStoredLogo)).toBe(false);

      await page.getByLabel("Website").fill("mobile-account.example.com/profile");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Business profile updated.")).toBeVisible();
      const { data: updatedBusiness } = await admin
        .from("businesses")
        .select("website, logo_path")
        .eq("id", business!.id)
        .single();
      expect(updatedBusiness).toEqual({
        website: "https://mobile-account.example.com/profile",
        logo_path: `${business!.id}/logo.webp`,
      });

      await page.getByRole("button", { name: "Remove logo" }).click();
      await expect(page.getByText("Business logo removed.")).toBeVisible();
      await expect(
        page.getByRole("main").getByLabel("Mobile Account Business logo").locator("img"),
      ).toHaveCount(0);
      const { data: removedBusiness } = await admin
        .from("businesses")
        .select("logo_path")
        .eq("id", business!.id)
        .single();
      expect(removedBusiness?.logo_path).toBeNull();
      const { data: remainingLogoObjects } = await admin.storage
        .from("business-logos")
        .list(business!.id);
      expect(remainingLogoObjects ?? []).toHaveLength(0);

      await page.goto("/dashboard");
      await page.getByRole("link", { name: "View active bookings" }).click();
      await expect(page).toHaveURL(/\/bookings\?filter=active/);

      await page.goto("/dashboard");
      await page.getByRole("link", { name: "View overdue bookings" }).click();
      await expect(page).toHaveURL(/\/bookings\?filter=overdue/);

      await page.goto("/dashboard");
      await page.getByRole("link", { name: "View customer records" }).click();
      await expect(page).toHaveURL(/\/customers/);

      await page.goto("/dashboard");
      await page
        .getByRole("link", { name: "View completed booking insights for this month" })
        .click();
      await expect(page).toHaveURL(/\/insights\?range=this_month/);

      await page.getByRole("button", { name: "Open account menu" }).click();
      await page.getByRole("menuitem", { name: "Log out" }).click();
      await expect(page).toHaveURL(/\/logout/);
      await page.getByRole("button", { name: "Log out" }).click();
      await expect(page).toHaveURL(/\/login\?message=signed-out/);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    } finally {
      await admin.storage.from("business-logos").remove([`${business!.id}/logo.webp`]);
      await admin.from("audit_logs").delete().eq("business_id", business!.id);
      await admin.from("business_members").delete().eq("business_id", business!.id);
      await admin.from("businesses").delete().eq("id", business!.id);
      await admin.auth.admin.deleteUser(userData.user!.id);
    }
  });
});
