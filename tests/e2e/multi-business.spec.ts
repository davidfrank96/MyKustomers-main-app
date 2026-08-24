import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CURRENT_BUSINESS_COOKIE_NAME } from "../../lib/auth/current-business-selection";

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

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `multi-business-admin-${randomUUID()}`,
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

test.describe("multi-business account support", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test("shows one current business without an unnecessary switch action", async ({
    page,
  }, testInfo) => {
    const admin = adminClient();
    const fixture = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `single-business-${testInfo.project.name}-${fixture}@example.com`;
    const password = `Single-Business-${randomUUID()}-A1`;
    let userId: string | null = null;
    let businessId: string | null = null;

    try {
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Single Business User" },
      });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const businessName = `Only Workspace ${fixture}`;
      const { data: business, error: businessError } = await admin
        .from("businesses")
        .insert({
          name: businessName,
          slug: `only-workspace-${fixture}`,
          category: "Other",
          created_by: userId,
          onboarding_completed_at: new Date().toISOString(),
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

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/business");

      const memberships = page.getByRole("list", {
        name: "Active business memberships",
      });
      const row = memberships.getByRole("listitem").filter({ hasText: businessName });
      await expect(page.getByRole("heading", { name: "My businesses" })).toBeVisible();
      await expect(row.getByText("Owner", { exact: true })).toBeVisible();
      await expect(row.getByText("Current business", { exact: true })).toBeVisible();
      await expect(memberships.getByRole("button", { name: "Switch" })).toHaveCount(0);
      await expectNoOverflow(page);

      await page.getByRole("link", { name: "Add another business" }).click();
      await expect(page).toHaveURL(/\/business\/new$/);
      await expect(page.getByRole("heading", { name: "Add another business" })).toBeVisible();
    } finally {
      if (businessId) await admin.from("businesses").delete().eq("id", businessId);
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });

  test("switches isolated workspaces and rejects stale or unauthorized selections", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    const admin = adminClient();
    const fixture = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `multi-business-${testInfo.project.name}-${fixture}@example.com`;
    const password = `Multi-Business-${randomUUID()}-A1`;
    const businessIds: string[] = [];
    const userIds: string[] = [];

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Multi Business User" },
    });
    expect(userError).toBeNull();
    userIds.push(userData.user!.id);

    const { data: otherOwner, error: otherOwnerError } =
      await admin.auth.admin.createUser({
        email: `multi-business-owner-${testInfo.project.name}-${fixture}@example.com`,
        password: `Multi-Business-Owner-${randomUUID()}-A1`,
        email_confirm: true,
      });
    expect(otherOwnerError).toBeNull();
    userIds.push(otherOwner.user!.id);

    async function createBusiness(name: string, slug: string, createdBy: string) {
      const { data, error } = await admin
        .from("businesses")
        .insert({
          name,
          slug,
          category: "Other",
          created_by: createdBy,
          onboarding_completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      businessIds.push(data!.id);
      return data!.id;
    }

    const businessAName = `Workspace Alpha ${fixture}`;
    const businessBName = `Workspace Beta ${fixture}`;
    const businessCName = `Workspace Private ${fixture}`;
    const businessAId = await createBusiness(
      businessAName,
      `workspace-alpha-${fixture}`,
      userData.user!.id,
    );
    const businessBId = await createBusiness(
      businessBName,
      `workspace-beta-${fixture}`,
      otherOwner.user!.id,
    );
    const businessCId = await createBusiness(
      businessCName,
      `workspace-private-${fixture}`,
      otherOwner.user!.id,
    );

    const oldMembershipTime = new Date(Date.now() - 60_000).toISOString();
    const newMembershipTime = new Date().toISOString();
    const { error: membershipError } = await admin.from("business_members").insert([
      {
        business_id: businessAId,
        user_id: userData.user!.id,
        role: "owner",
        status: "active",
        created_at: oldMembershipTime,
      },
      {
        business_id: businessBId,
        user_id: otherOwner.user!.id,
        role: "owner",
        status: "active",
        created_at: oldMembershipTime,
      },
      {
        business_id: businessBId,
        user_id: userData.user!.id,
        role: "member",
        status: "active",
        created_at: newMembershipTime,
      },
      {
        business_id: businessCId,
        user_id: otherOwner.user!.id,
        role: "owner",
        status: "active",
        created_at: newMembershipTime,
      },
    ]);
    expect(membershipError).toBeNull();

    const customerAName = `Alpha Customer ${fixture}`;
    const customerBName = `Beta Customer ${fixture}`;
    const { data: customers, error: customerError } = await admin
      .from("customers")
      .insert([
        { business_id: businessAId, name: customerAName },
        { business_id: businessBId, name: customerBName },
      ])
      .select("id, business_id");
    expect(customerError).toBeNull();
    const customerAId = customers!.find(
      (customer) => customer.business_id === businessAId,
    )!.id;
    const customerBId = customers!.find(
      (customer) => customer.business_id === businessBId,
    )!.id;

    const bookingATitle = `Alpha Booking ${fixture}`;
    const bookingBTitle = `Beta Booking ${fixture}`;
    const { error: bookingError } = await admin.from("bookings").insert([
      {
        business_id: businessAId,
        customer_id: customerAId,
        title: bookingATitle,
        currency: "EUR",
        total_amount_minor: 10000,
        deposit_amount_minor: 0,
        created_by: userData.user!.id,
      },
      {
        business_id: businessBId,
        customer_id: customerBId,
        title: bookingBTitle,
        currency: "EUR",
        total_amount_minor: 20000,
        deposit_amount_minor: 0,
        created_by: otherOwner.user!.id,
      },
    ]);
    expect(bookingError).toBeNull();

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        }),
      ).toBeVisible();

      await page
        .getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        })
        .click();
      await page.getByRole("menuitem", { name: new RegExp(businessBName) }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessBName}`,
        }),
      ).toBeVisible();

      await page.goto("/customers");
      await expect(page.getByRole("heading", { name: customerBName })).toBeVisible();
      await expect(page.getByText(customerAName)).toHaveCount(0);

      await page.goto("/bookings");
      await expect(page.getByRole("heading", { name: bookingBTitle })).toBeVisible();
      await expect(page.getByText(bookingATitle)).toHaveCount(0);

      await page.goto("/business");
      const membershipList = page.getByRole("list", {
        name: "Active business memberships",
      });
      const businessARow = membershipList
        .getByRole("listitem")
        .filter({ hasText: businessAName });
      const businessBRow = membershipList
        .getByRole("listitem")
        .filter({ hasText: businessBName });
      await expect(page.getByRole("heading", { name: "My businesses" })).toBeVisible();
      await expect(businessARow.getByText("Owner", { exact: true })).toBeVisible();
      await expect(businessBRow.getByText("Member", { exact: true })).toBeVisible();
      await expect(
        businessBRow.getByText("Current business", { exact: true }),
      ).toBeVisible();
      await businessARow.getByRole("button", { name: "Switch" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        }),
      ).toBeVisible();

      await page.goto("/business");
      await expect(
        page
          .getByRole("list", { name: "Active business memberships" })
          .getByRole("listitem")
          .filter({ hasText: businessAName })
          .getByText("Current business", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Business name")).toBeEnabled();

      await page.context().addCookies([
        {
          name: CURRENT_BUSINESS_COOKIE_NAME,
          value: businessCId,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/dashboard");
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        }),
      ).toBeVisible();

      await page.goto("/business");
      const forgedForm = page
        .getByRole("list", { name: "Active business memberships" })
        .getByRole("listitem")
        .filter({ hasText: businessBName })
        .locator("form[data-business-page-switch-form]");
      await forgedForm.evaluate((form, businessId) => {
        const businessIdInput = form.querySelector<HTMLInputElement>(
          'input[name="businessId"]',
        );
        const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');

        if (!businessIdInput || !submitter) {
          throw new Error("Business switch form controls are unavailable.");
        }

        businessIdInput.value = businessId;
        (form as HTMLFormElement).requestSubmit(submitter);
      }, businessCId);
      await expect(page).toHaveURL(/\/dashboard\?business=unavailable$/);
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        }),
      ).toBeVisible();

      const additionalName = `Workspace New ${fixture}`;
      const additionalSlug = `workspace-new-${fixture}`;
      await page.goto("/business/new");
      await page.getByLabel("Business name").fill(additionalName);
      await page.getByLabel("Business slug").fill(additionalSlug);
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Other" }).click();
      await page.getByRole("button", { name: "Create business" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${additionalName}`,
        }),
      ).toBeVisible();
      const { data: additionalBusiness } = await admin
        .from("businesses")
        .select("id")
        .eq("slug", additionalSlug)
        .single();
      businessIds.push(additionalBusiness!.id);

      await page
        .getByRole("button", {
          name: `Switch business. Current business: ${additionalName}`,
        })
        .click();
      await page.getByRole("menuitem", { name: new RegExp(businessBName) }).click();
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessBName}`,
        }),
      ).toBeVisible();
      await admin
        .from("business_members")
        .delete()
        .eq("business_id", businessBId)
        .eq("user_id", userData.user!.id);
      await page.reload();
      await expect(
        page.getByRole("button", {
          name: `Switch business. Current business: ${businessAName}`,
        }),
      ).toBeVisible();

      if (testInfo.project.name === "chromium") {
        for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
          await page.goto("/dashboard");
          await expectNoOverflow(page);
          await page.goto("/business");
          await expect(page.getByRole("heading", { name: "My businesses" })).toBeVisible();
          await expectNoOverflow(page);
          const switchButton = page
            .getByRole("button", { name: "Switch", exact: true })
            .first();
          if (await switchButton.isVisible()) {
            const box = await switchButton.boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
          const mobileNavigation = page.getByRole("navigation", {
            name: "Mobile vendor navigation",
          });
          if (width < 1024) {
            await expect(mobileNavigation).toBeVisible();
          } else {
            await expect(mobileNavigation).toBeHidden();
          }
        }
      }
    } finally {
      const { data: bookings } = await admin
        .from("bookings")
        .select("id")
        .in("business_id", businessIds);
      const bookingIds = bookings?.map((booking) => booking.id) ?? [];
      if (bookingIds.length > 0) {
        await admin.from("booking_status_history").delete().in("booking_id", bookingIds);
      }
      await admin.from("bookings").delete().in("business_id", businessIds);
      await admin.from("customers").delete().in("business_id", businessIds);
      await admin.from("audit_logs").delete().in("business_id", businessIds);
      await admin.from("businesses").delete().in("id", businessIds);
      await Promise.allSettled(
        userIds.map((userId) => admin.auth.admin.deleteUser(userId)),
      );
    }
  });
});
