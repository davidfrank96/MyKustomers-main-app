import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
        storageKey: `phase4-e2e-admin-${randomUUID()}`,
      },
    },
  );
}

function testEmail(projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `phase4-e2e-customers-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
  createdEmails.add(email);
  return email;
}

async function createConfirmedBusinessOwner({
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
      display_name: "Phase 4 E2E Owner",
    },
  });

  expect(userError).toBeNull();
  expect(userData.user?.id).toBeTruthy();

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .insert({
      name: "Phase 4 E2E Business",
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

  return business!.id;
}

test.describe("customer management", () => {
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

  test("business user can create, edit, and archive a customer", async ({
    page,
  }, testInfo) => {
    const email = testEmail(testInfo.project.name);
    const password = `Phase4-E2E-${randomUUID()}-A1`;
    const slug = `phase4-e2e-customers-${Date.now()}-${randomUUID().slice(0, 8)}`;
    createdBusinessSlugs.add(slug);
    await createConfirmedBusinessOwner({ email, password, slug });

    const customerName = `Phase 4 Customer ${randomUUID().slice(0, 8)}`;
    const updatedName = `${customerName} Updated`;

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Add customer" }).click();

    await page.getByLabel("Name").fill(customerName);
    await page.getByLabel("Email").fill("phase4-customer@example.com");
    await page.getByLabel("Phone").fill("+353 01 555 0144");
    await page.getByLabel("Notes").fill("Created through Phase 4 E2E.");
    await page.getByRole("button", { name: "Create customer" }).click();

    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\?created=1/);
    await expect(page.getByRole("heading", { name: customerName })).toBeVisible();

    await page.getByLabel("Name").fill(updatedName);
    await page.getByLabel("Notes").fill("Updated through Phase 4 E2E.");
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText("Customer updated.")).toBeVisible();
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(updatedName) })).toHaveCount(0);

    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page.getByRole("link", { name: new RegExp(updatedName) })).toBeVisible();
  });

  test("customer search updates live, composes with archive filters, and clears", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The explicit viewport matrix runs once.");

    const email = testEmail(testInfo.project.name);
    const password = `Phase4-Search-${randomUUID()}-A1`;
    const suffix = randomUUID().slice(0, 8);
    const slug = `phase4-search-${Date.now()}-${suffix}`;
    const searchQuery = `Live Search Sarah ${suffix}`;
    const activeName = `${searchQuery} Active`;
    const archivedName = `${searchQuery} Archived`;
    createdBusinessSlugs.add(slug);
    const businessId = await createConfirmedBusinessOwner({ email, password, slug });
    const admin = createAdminClient();
    const { data: customers, error: customersError } = await admin
      .from("customers")
      .insert([
        {
          business_id: businessId,
          name: activeName,
          email: `active-${suffix}@example.com`,
          phone: null,
        },
        {
          business_id: businessId,
          name: archivedName,
          email: `archived-${suffix}@example.com`,
          phone: null,
        },
        {
          business_id: businessId,
          name: `Live Search David ${suffix}`,
          email: `david-${suffix}@example.com`,
          phone: null,
        },
      ])
      .select("id, name, created_at");
    expect(customersError).toBeNull();
    const archivedCustomer = customers?.find((customer) => customer.name === archivedName);
    expect(archivedCustomer).toBeTruthy();
    const { error: archiveError } = await admin
      .from("customers")
      .update({
        archived_at: new Date(
          new Date(archivedCustomer!.created_at).getTime() + 1_000,
        ).toISOString(),
      })
      .eq("id", archivedCustomer!.id);
    expect(archiveError).toBeNull();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/customers?status=active&page=7");
    const search = page.getByLabel("Search customers");
    await search.fill(searchQuery);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe(searchQuery);
    expect(new URL(page.url()).searchParams.get("status")).toBe("active");
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await expect(page.getByRole("link", { name: new RegExp(activeName) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(archivedName) })).toHaveCount(0);

    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("status"))
      .toBe("archived");
    expect(new URL(page.url()).searchParams.get("q")).toBe(searchQuery);
    await expect(page.getByRole("link", { name: new RegExp(archivedName) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(activeName) })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear customer search" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    expect(new URL(page.url()).searchParams.get("status")).toBe("archived");
    await expect(page.getByRole("link", { name: new RegExp(archivedName) })).toBeVisible();

    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  });
});
