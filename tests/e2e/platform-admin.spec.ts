import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { CURRENT_BUSINESS_COOKIE_NAME } from "../../lib/auth/current-business-selection";
import type { Database } from "@/types/database";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
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
const safeTargets = new Set([
  "local",
  "dev",
  "development",
  "test",
  "testing",
  "staging",
]);
const canRunMutatingAdminE2e =
  hasSupabaseEnv &&
  process.env.PHASE2_RUNTIME_VERIFICATION === "1" &&
  safeTargets.has((process.env.PHASE2_SUPABASE_TARGET ?? "").toLowerCase());

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
  test.skip(
    !canRunMutatingAdminE2e,
    "Requires explicit runtime opt-in and a non-production Supabase target.",
  );

  test("denies vendors and disabled admins while rendering global operations for an active admin", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once.",
    );
    test.setTimeout(180_000);

    const service = createAdminClient();
    const fixture = `pa-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const password = `Platform-Admin-${randomUUID()}-A1`;
    const createdUserIds: string[] = [];
    const platformAuditIds: string[] = [];
    const businessIds: string[] = [];

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
      businessIds.push(business!.id);
      const { error: membershipError } = await service.from("business_members").insert({
        business_id: business!.id,
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
      await page.goto("/admin/businesses");
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);

      await signIn(page, vendor.email, password);
      await expect(page).toHaveURL(/\/dashboard/);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await expect(page.getByText("My Customers Admin")).toHaveCount(0);
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/bookings");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/issues");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/emails");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/security");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();

      await page.context().clearCookies();
      await signIn(page, activeAdmin.email, password);
      await expect(page).toHaveURL(/\/onboarding/);
      await page.goto("/admin");
      await expect(page.getByText("My Customers Admin")).toBeVisible();
      await expect(page.getByText("Role: Super Admin")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Platform scale" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Booking operations" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
      for (const label of [
        "Businesses",
        "Platform users",
        "Customers",
        "Bookings",
        "Active bookings",
        "Due today",
        "Overdue",
        "Completed",
        "Failed emails",
        "Open booking issues",
      ]) {
        await expect(page.locator(`[data-admin-metric="${label}"]`)).toBeVisible();
      }
      const adminNavigation = page.getByRole("navigation", { name: "Admin navigation" });
      await expect(adminNavigation.getByRole("link")).toHaveCount(8);
      await adminNavigation.getByRole("link", { name: "Security" }).click();
      await expect(page.getByRole("heading", { name: "Admin security" })).toBeVisible();
      await expect(page.getByText("Not configured")).toBeVisible();
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin$/);

      await page.reload();
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

      const adminBusinessRows = ["Admin A", "Admin B"].map((label, index) => ({
        name: `Platform Admin E2E ${label}`,
        slug: `${fixture}-admin-${index + 1}`,
        category: "Other",
        onboarding_completed_at: new Date().toISOString(),
        created_by: activeAdmin.id,
      }));
      const { data: adminBusinesses, error: adminBusinessesError } = await service
        .from("businesses")
        .insert(adminBusinessRows)
        .select("id");
      expect(adminBusinessesError).toBeNull();
      businessIds.push(...adminBusinesses!.map((row) => row.id));
      const { error: adminMembershipsError } = await service
        .from("business_members")
        .insert(
          adminBusinesses!.map((row) => ({
            business_id: row.id,
            user_id: activeAdmin.id,
            role: "owner" as const,
            status: "active" as const,
          })),
        );
      expect(adminMembershipsError).toBeNull();

      await page.goto("/admin/businesses");
      await expect(page.getByRole("heading", { name: "Businesses" })).toBeVisible();
      await page
        .getByRole("searchbox", { name: "Search businesses" })
        .fill("Platform Admin E2E Admin A");
      await expect
        .poll(() => new URL(page.url()).searchParams.get("q"))
        .toBe("Platform Admin E2E Admin A");
      const businessLink = page.getByRole("link", {
        name: /Platform Admin E2E Admin A/,
      });
      await expect(businessLink).toBeVisible();
      await businessLink.click();
      await expect(
        page.getByRole("heading", { name: "Platform Admin E2E Admin A" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Operational summary" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Memberships" })).toBeVisible();

      const userLink = page.getByRole("link", {
        name: new RegExp(activeAdmin.email),
      });
      await expect(userLink).toBeVisible();
      await userLink.click();
      await expect(
        page.getByRole("heading", { name: "Platform admin E2E active" }),
      ).toBeVisible();
      await expect(page.getByText("Platform administrator")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Business memberships" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Platform Admin E2E Admin A/ }),
      ).toBeVisible();

      await page.goto("/admin/users");
      await page.getByRole("searchbox", { name: "Search users" }).fill(activeAdmin.email);
      await expect(
        page.getByRole("link", { name: new RegExp(activeAdmin.email) }),
      ).toBeVisible();
      await page.getByRole("searchbox", { name: "Search users" }).fill("%_,.'\"()");
      await expect(page.getByText(/No users match/)).toBeVisible();

      await page.goto(`/admin/businesses/${randomUUID()}`);
      await expect(
        page.getByRole("heading", { name: "Business not found" }),
      ).toBeVisible();
      await page.goto(`/admin/users/${randomUUID()}`);
      await expect(page.getByRole("heading", { name: "User not found" })).toBeVisible();
      await page.goto(`/admin/bookings/${randomUUID()}`);
      await expect(
        page.getByRole("heading", { name: "Booking not found" }),
      ).toBeVisible();
      await page.goto(`/admin/issues/${randomUUID()}`);
      await expect(page.getByRole("heading", { name: "Issue not found" })).toBeVisible();
      await page.goto(`/admin/emails/${randomUUID()}`);
      await expect(
        page.getByRole("heading", { name: "Email event not found" }),
      ).toBeVisible();

      await page.goto("/admin");
      const metricIdentities = await page
        .locator("[data-admin-metric]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-admin-metric")),
        );
      const filteredBusinessesUrl = `/admin/businesses?q=${encodeURIComponent(fixture)}`;
      await page.goto(filteredBusinessesUrl);
      const businessDirectoryText = await page
        .locator('[data-admin-directory="businesses"]')
        .allTextContents();
      expect(businessDirectoryText.join(" ")).toContain("Platform Admin E2E Admin A");
      expect(businessDirectoryText.join(" ")).toContain("Platform Admin E2E Admin B");
      const origin = new URL(page.url()).origin;
      for (const business of adminBusinesses!) {
        await page.context().addCookies([
          {
            name: CURRENT_BUSINESS_COOKIE_NAME,
            value: business.id,
            url: origin,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await page.goto("/admin");
        expect(
          await page
            .locator("[data-admin-metric]")
            .evaluateAll((elements) =>
              elements.map((element) => element.getAttribute("data-admin-metric")),
            ),
        ).toEqual(metricIdentities);
        await page.goto(filteredBusinessesUrl);
        expect(
          await page.locator('[data-admin-directory="businesses"]').allTextContents(),
        ).toEqual(businessDirectoryText);
      }

      await page.getByRole("link", { name: "Vendor workspace" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

      const responsiveRoutes = [
        "/admin",
        "/admin/businesses",
        `/admin/businesses/${adminBusinesses![0].id}`,
        "/admin/users",
        `/admin/users/${activeAdmin.id}`,
        "/admin/bookings",
        "/admin/issues",
        "/admin/emails",
        "/admin/security",
      ];
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        for (const route of responsiveRoutes) {
          await page.goto(route);
          await expect(page.locator("h1")).toBeVisible();
          await expectNoOverflow(page, width);
        }
      }

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await expect(page.getByText("My Customers Admin")).toHaveCount(0);
      await page.goto("/admin/businesses");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/bookings");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/issues");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/emails");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
      await page.goto("/admin/security");
      await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
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
      if (businessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    }
  });
});
