import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database } from "@/types/database";

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

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `platform-admin-e2e-${randomUUID()}`,
      },
    },
  );
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function expectNoOverflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth, `/admin overflowed at ${width}px`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

test.describe("platform admin route authorization", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("denies vendors and disabled admins while allowing an active zero-business admin", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The explicit viewport matrix runs once.");
    test.setTimeout(120_000);

    const service = createAdminClient();
    const fixture = `pa-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const password = `Platform-Admin-${randomUUID()}-A1`;
    const createdUserIds: string[] = [];
    const platformAuditIds: string[] = [];
    let businessId: string | null = null;

    async function createUser(label: string) {
      const email = `${fixture}-${label}@example.com`.toLowerCase();
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Platform admin E2E ${label}` },
      });
      expect(error).toBeNull();
      createdUserIds.push(data.user!.id);
      return { id: data.user!.id, email };
    }

    const vendor = await createUser("vendor");
    const activeAdmin = await createUser("active");
    try {
      const { data: business, error: businessError } = await service
        .from("businesses")
        .insert({
          name: "Platform Admin E2E Vendor",
          slug: fixture,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: vendor.id,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      businessId = business!.id;
      const { error: membershipError } = await service.from("business_members").insert({
        business_id: businessId,
        user_id: vendor.id,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();

      const { error: platformAdminError } = await service
        .from("platform_admins")
        .insert({ user_id: activeAdmin.id, role: "SUPER_ADMIN", status: "ACTIVE" });
      expect(platformAdminError).toBeNull();

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);

      await signIn(page, vendor.email, password);
      await expect(page).toHaveURL(/\/dashboard/);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await expect(page.getByText("My Customers Admin")).toHaveCount(0);

      await page.context().clearCookies();
      await signIn(page, activeAdmin.email, password);
      await expect(page).toHaveURL(/\/onboarding/);
      await page.goto("/admin");
      await expect(page.getByText("My Customers Admin")).toBeVisible();
      await expect(page.getByText("Role: Super Admin")).toBeVisible();
      await expect(page.getByText("System: Admin access verified")).toBeVisible();
      const adminNavigation = page.getByRole("navigation", { name: "Admin navigation" });
      await expect(adminNavigation.getByRole("link")).toHaveCount(2);
      await expect(page).toHaveURL(/\/admin$/);

      await page.reload();
      await expect(page.getByText("System: Admin access verified")).toBeVisible();

      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await page.goto("/admin");
        await expect(page.getByText("System: Admin access verified")).toBeVisible();
        await expectNoOverflow(page, width);
      }

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await expect(page.getByText("My Customers Admin")).toHaveCount(0);
    } finally {
      const { data: audits } = await service
        .from("audit_logs")
        .select("id, metadata")
        .in("event_type", [
          "PLATFORM_ADMIN_CREATED",
          "PLATFORM_ADMIN_UPDATED",
          "PLATFORM_ADMIN_DISABLED",
        ])
        .gte("created_at", new Date(Date.now() - 180_000).toISOString());
      platformAuditIds.push(
        ...(audits ?? [])
          .filter((row) =>
            createdUserIds.includes(
              String((row.metadata as Record<string, unknown>).target_user_id),
            ),
          )
          .map((row) => row.id),
      );
      if (platformAuditIds.length > 0) {
        await service.from("audit_logs").delete().in("id", platformAuditIds);
      }
      await service.from("platform_admins").delete().in("user_id", createdUserIds);
      if (businessId) {
        await service.from("audit_logs").delete().eq("business_id", businessId);
        await service.from("businesses").delete().eq("id", businessId);
      }
      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    }
  });
});
