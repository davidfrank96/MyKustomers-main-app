import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "./support/test";
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
    const businessId = await createConfirmedBusinessOwner({ email, password, slug });

    const customerName = `Phase 4 Customer ${randomUUID().slice(0, 8)}`;
    const updatedName = `${customerName} Updated`;

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/customers");
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Add customer" }).first().click();

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

    const detailUrl = new URL(page.url());
    detailUrl.search = "";
    await page.goto(detailUrl.toString());

    for (const width of [320, 360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
      await expect(page.getByRole("button", { name: "Archive customer" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Customer details" })).toBeVisible();
      await expect(page.getByLabel("Phone (optional)")).toHaveAttribute(
        "placeholder",
        "Enter phone number",
      );
      await expect(page.getByLabel("Notes (optional)")).toHaveAttribute(
        "placeholder",
        "Add any notes about this customer...",
      );

      const saveCustomer = page.getByRole("button", { name: "Save customer" });
      await saveCustomer.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      const saveBox = await saveCustomer.boundingBox();
      const navigationBox = await page
        .getByRole("navigation", { name: "Mobile vendor navigation" })
        .boundingBox();
      expect(saveBox).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(navigationBox!.y);

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

      if (width === 390) {
        fs.mkdirSync("test-results/mobile-customer-detail", { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        const screenshotStyles = await page.addStyleTag({
          content: `
            header { position: relative !important; }
            nav[aria-label="Mobile vendor navigation"] { position: static !important; }
          `,
        });
        await page.evaluate(() => {
          document.querySelectorAll("nextjs-portal").forEach((element) => {
            element.parentNode?.removeChild(element);
          });
        });
        await page.screenshot({
          path: "test-results/mobile-customer-detail/customer-detail-390.png",
          fullPage: true,
        });
        await screenshotStyles.evaluate((element) =>
          element.parentNode?.removeChild(element),
        );
      }
    }

    await page.getByRole("button", { name: "Archive customer" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(updatedName) })).toHaveCount(
      0,
    );

    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page.getByRole("link", { name: new RegExp(updatedName) })).toBeVisible();

    const nameOnlyCustomer = `Name Only Customer ${randomUUID().slice(0, 8)}`;
    await page.goto("/customers/new");
    await page.getByLabel("Name", { exact: true }).fill(nameOnlyCustomer);
    await page.getByRole("button", { name: "Create customer" }).dblclick();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\?created=1/);
    await expect(
      page.getByRole("heading", { name: nameOnlyCustomer, exact: true }),
    ).toBeVisible();

    const { count: nameOnlyCount, error: nameOnlyError } = await createAdminClient()
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("name", nameOnlyCustomer);
    expect(nameOnlyError).toBeNull();
    expect(nameOnlyCount).toBe(1);
  });

  test("customer search updates live, composes with archive filters, and clears", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The explicit viewport matrix runs once.",
    );
    test.setTimeout(120_000);

    const email = testEmail(testInfo.project.name);
    const password = `Phase4-Search-${randomUUID()}-A1`;
    const suffix = randomUUID().slice(0, 8);
    const slug = `phase4-search-${Date.now()}-${suffix}`;
    const searchQuery = `Live Search Sarah ${suffix}`;
    const activeName = `${searchQuery} Active`;
    const archivedName = `${searchQuery} Archived`;
    createdBusinessSlugs.add(slug);
    const businessId = await createConfirmedBusinessOwner({ email, password, slug });
    const listCustomers = Array.from({ length: 52 }, (_, index) => ({
      business_id: businessId,
      name: `Customer List Fixture ${String(index + 1).padStart(2, "0")} ${suffix}`,
      email: `list-${index + 1}-${suffix}@example.com`,
      phone: null,
    }));
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
        ...listCustomers,
      ])
      .select("id, name, created_at");
    expect(customersError).toBeNull();
    const archivedCustomer = customers?.find(
      (customer) => customer.name === archivedName,
    );
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
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/customers?status=active&page=7");
    const search = page.getByLabel("Search customers");
    await search.fill(searchQuery);
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(searchQuery);
    expect(new URL(page.url()).searchParams.get("status")).toBe("active");
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await expect(page.getByRole("link", { name: new RegExp(activeName) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(archivedName) })).toHaveCount(
      0,
    );

    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("status"))
      .toBe("archived");
    expect(new URL(page.url()).searchParams.get("q")).toBe(searchQuery);
    await expect(
      page.getByRole("link", { name: new RegExp(archivedName) }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(activeName) })).toHaveCount(0);

    await page.getByRole("link", { name: "All", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("all");
    expect(new URL(page.url()).searchParams.get("q")).toBe(searchQuery);
    await expect(page.getByRole("link", { name: new RegExp(activeName) })).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(archivedName) }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear customer search" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("q")).toBe(false);
    expect(new URL(page.url()).searchParams.get("status")).toBe("all");
    await expect(page.getByText("Showing 25 of 55 customers.")).toBeVisible();
    const loadMoreCustomers = page.getByRole("button", { name: "Load more" });
    await loadMoreCustomers.click();
    await expect(page.getByText("Showing 50 of 55 customers.")).toBeVisible();
    await loadMoreCustomers.click();
    await expect(page.getByText("Showing 55 of 55 customers.")).toBeVisible();
    await expect(loadMoreCustomers).toHaveCount(0);
    const customerHrefs = await page
      .locator('a[href^="/customers/"]:not([href="/customers/new"])')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(customerHrefs).toHaveLength(55);
    expect(new Set(customerHrefs).size).toBe(55);

    await page.goto("/customers?status=active");
    const mobileActions = page.locator("[data-customers-mobile-actions]");
    const addCustomerFab = mobileActions.getByRole("link", { name: "Add customer" });
    const backToTop = mobileActions.locator('button[aria-label="Back to top"]');
    const topAddCustomer = page.locator('a[href="/customers/new"]').first();

    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

      if (width < 1024) {
        await expect(topAddCustomer).toBeVisible();
        await expect(mobileActions).toBeVisible();
        await expect(addCustomerFab).toBeVisible();
        const actionBox = await mobileActions.boundingBox();
        const navigationBox = await page
          .getByRole("navigation", { name: "Mobile vendor navigation" })
          .boundingBox();
        expect(actionBox).not.toBeNull();
        expect(navigationBox).not.toBeNull();
        expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navigationBox!.y);
        expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(width - 8);
      } else {
        await expect(mobileActions).toBeHidden();
      }
    }

    fs.mkdirSync("output/playwright/customers-mobile-actions", { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(backToTop).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('a[href="/customers/new"]')).toHaveCount(2);
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
    });
    await page.screenshot({
      path: "output/playwright/customers-mobile-actions/customers-top-390.png",
    });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const scrolled390 = await page.evaluate(() => ({
      scrollY: window.scrollY,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(scrolled390.scrollY).toBeGreaterThanOrEqual(scrolled390.maxScroll - 1);
    await expect(backToTop).toHaveAttribute(
      "aria-hidden",
      scrolled390.maxScroll >= 480 ? "false" : "true",
    );
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
    });
    await page.screenshot({
      path: "output/playwright/customers-mobile-actions/customers-scrolled-390.png",
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const scrolled320 = await page.evaluate(() => ({
      scrollY: window.scrollY,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(scrolled320.scrollY).toBeGreaterThanOrEqual(scrolled320.maxScroll - 1);
    await expect(backToTop).toHaveAttribute(
      "aria-hidden",
      scrolled320.maxScroll >= 480 ? "false" : "true",
    );
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
    });
    await page.screenshot({
      path: "output/playwright/customers-mobile-actions/customers-scrolled-320.png",
    });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastCustomerRow = page
      .locator('a[href^="/customers/"]:not([href="/customers/new"])')
      .last();
    await expect(lastCustomerRow).toBeVisible();
    await lastCustomerRow.scrollIntoViewIfNeeded();
    const lastCustomerBox = await lastCustomerRow.boundingBox();
    const loadMoreButton = page.getByRole("button", {
      name: "Load more",
      exact: true,
    });
    await expect(loadMoreButton).toBeVisible();
    const loadMoreBox = await loadMoreButton.boundingBox();
    const actionsBox = await mobileActions.boundingBox();
    expect(lastCustomerBox).not.toBeNull();
    expect(loadMoreBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(lastCustomerBox!.y + lastCustomerBox!.height).toBeLessThanOrEqual(
      actionsBox!.y,
    );
    expect(loadMoreBox!.y + loadMoreBox!.height).toBeLessThanOrEqual(actionsBox!.y);

    if (scrolled320.maxScroll >= 480) {
      await backToTop.click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
      await expect(backToTop).toHaveAttribute("aria-hidden", "true");
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    await addCustomerFab.click();
    await expect(page).toHaveURL(/\/customers\/new$/);
    await expect(page.getByRole("heading", { name: "Add customer" })).toBeVisible();
  });
});
