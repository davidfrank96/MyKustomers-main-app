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
const signupInboxEmail = process.env.E2E_SIGNUP_EMAIL;

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase2-e2e-admin-${randomUUID()}`,
      },
    },
  );
}

function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase2-e2e-public-${randomUUID()}`,
      },
    },
  );
}

function testEmail(label: string, projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `phase2v-e2e-${label}-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
  createdEmails.add(email);
  return email;
}

function signupEmail(projectName: string) {
  test.skip(
    !signupInboxEmail,
    "Requires E2E_SIGNUP_EMAIL pointing at a safe inbox for default Supabase email verification.",
  );

  const [localPart, domain] = signupInboxEmail!.split("@");
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const suffix = `phase2e-${safeProject}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email =
    localPart && domain ? `${localPart}+${suffix}@${domain}` : signupInboxEmail!;

  createdEmails.add(email);
  return email;
}

async function createConfirmedUser(email: string, password: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Phase 2V E2E User",
    },
  });

  expect(error).toBeNull();
  expect(data.user?.id).toBeTruthy();
  return data.user!.id;
}

async function findUserIdByEmail(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  expect(error).toBeNull();
  return data.users.find((user) => user.email === email)?.id ?? null;
}

test.describe("Supabase authentication journeys", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test.afterAll(async () => {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const usersToDelete = data?.users.filter((user) =>
      user.email ? createdEmails.has(user.email) : false,
    );

    await Promise.allSettled(
      (usersToDelete ?? []).map((user) => admin.auth.admin.deleteUser(user.id)),
    );
  });

  test("valid signup creates an auth user and profile", async ({ page }, testInfo) => {
    const email = signupEmail(testInfo.project.name);
    const password = `Phase2v-Signup-${randomUUID()}-A1`;

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Phase 2V Signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    const successState = page.getByText(/check your email|authenticated workspace/i).or(
      page.getByRole("heading", { name: "Welcome back" }),
    );
    const providerLimitOrGenericError = page.getByText(
      /Too many attempts\. Please wait and try again\.|Something went wrong\. Please try again\./,
    );
    await expect(successState.or(providerLimitOrGenericError)).toBeVisible();

    if (await providerLimitOrGenericError.isVisible()) {
      const probeEmail = testEmail("signup-probe", testInfo.project.name);
      const { error: probeError } = await createPublicClient().auth.signUp({
        email: probeEmail,
        password: `Phase2v-Probe-${randomUUID()}-A1`,
        options: {
          data: {
            display_name: "Phase 2V Signup Probe",
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
        },
      });

      test.skip(
        probeError?.message.toLowerCase().includes("rate limit") ?? false,
        "Supabase signup email rate limit exceeded in the configured development project.",
      );
    }

    await expect(successState).toBeVisible();

    const userId = await findUserIdByEmail(email);
    expect(userId).toBeTruthy();

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.id).toBe(userId);

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Phase 2V Signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText(/check your email|account may already exist|try logging in/i),
    ).toBeVisible();
  });

  test("valid login persists through refresh and logout removes protected access", async ({
    page,
  }, testInfo) => {
    const email = testEmail("login", testInfo.project.name);
    const password = `Phase2v-Login-${randomUUID()}-A1`;
    await createConfirmedUser(email, password);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Set up your business" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Set up your business" })).toBeVisible();

    await page.goto("/logout");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("OAuth-style profile metadata provisions safely and follows normal onboarding", async ({
    page,
  }, testInfo) => {
    const email = testEmail("oauth-profile", testInfo.project.name);
    const password = `Phase2v-Oauth-${randomUUID()}-A1`;
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "OAuth Style User",
        avatar_url: "https://example.com/avatar.png",
      },
    });
    expect(error).toBeNull();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("id", data.user!.id)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.id).toBe(data.user!.id);
    expect(profile?.display_name).toBeNull();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("Google controls fail closed when the provider is disabled", async ({
    page,
  }, testInfo) => {
    const settingsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
      },
    );
    const settings = (await settingsResponse.json()) as {
      external?: { google?: boolean };
    };
    const googleEnabled = settings.external?.google === true;

    for (const path of ["/login?next=https://attacker.example", "/signup"]) {
      await page.goto(path);
      const googleButton = page.getByRole("button", { name: "Continue with Google" });
      await expect(googleButton).toBeVisible();
      if (googleEnabled) {
        await expect(googleButton).toBeEnabled();
      } else {
        await expect(googleButton).toBeDisabled();
      }

      if (!googleEnabled) {
        await expect(
          page.getByText("Google sign-in is not available yet. Use email to continue."),
        ).toBeVisible();
      }
    }

    await page.goto(
      "/auth/callback?error=access_denied&error_description=private&next=https://attacker.example",
    );
    await expect(page).toHaveURL(/\/login\?message=oauth-error$/);
    await expect(
      page.getByText("Google sign-in was not completed. Try again or use email."),
    ).toBeVisible();
    await expect(page.getByText("private")).toHaveCount(0);

    if (testInfo.project.name === "chromium") {
      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
        await page.goto("/login");
        await expect(
          page.getByRole("button", { name: "Continue with Google" }),
        ).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      }
    }
  });

  test("invalid login and forgot password responses are safe", async ({ page }, testInfo) => {
    const email = testEmail("missing", testInfo.project.name);

    await page.goto("/auth/callback?next=%E0%A4%A");
    await expect(page).toHaveURL(/\/login\?message=auth-error/);

    await page.goto("/auth/callback?code=invalid&next=https://attacker.example");
    await expect(page).toHaveURL(/\/login\?message=auth-error/);

    await page.goto("/login?next=https://attacker.example");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("WrongPassword1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("We could not verify those credentials.")).toBeVisible();
    await expect(
      page
        .locator("form")
        .filter({ has: page.getByLabel("Email") })
        .locator('input[name="next"]'),
    ).toHaveValue("/dashboard");

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByText("If an account exists for that email, a reset link will be sent."),
    ).toBeVisible();
  });
});
