import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
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
const screenshotDirectory = path.resolve("output/playwright/create-business-redesign");

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function expectCreateFormAlignment(page: import("@playwright/test").Page) {
  const alignment = await page.evaluate(() => {
    const controls = [
      document.getElementById("name"),
      document.getElementById("slug"),
      document.getElementById("category"),
      document.getElementById("description"),
      document.getElementById("whatsapp"),
      document.getElementById("instagram"),
      document.getElementById("website"),
      document.getElementById("addressText"),
      document.querySelector('button[type="submit"]'),
    ].filter((control): control is HTMLElement => control instanceof HTMLElement);
    const rects = controls.map((control) => control.getBoundingClientRect());
    const leftEdges = rects.map((rect) => rect.left);
    const rightEdges = rects.map((rect) => rect.right);

    return {
      controlCount: controls.length,
      leftDrift: Math.max(...leftEdges) - Math.min(...leftEdges),
      rightDrift: Math.max(...rightEdges) - Math.min(...rightEdges),
    };
  });

  expect(alignment.controlCount).toBe(9);
  expect(alignment.leftDrift).toBeLessThanOrEqual(1);
  expect(alignment.rightDrift).toBeLessThanOrEqual(1);
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `phase3-e2e-admin-${randomUUID()}`,
      },
    },
  );
}

function testEmail(projectName: string) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `phase3-e2e-onboarding-${safeProject}-${Date.now()}-${randomUUID()}@example.com`;
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
      display_name: "Phase 3 E2E Owner",
    },
  });

  expect(error).toBeNull();
  expect(data.user?.id).toBeTruthy();
  return data.user!.id;
}

test.describe("business onboarding", () => {
  test.skip(!hasSupabaseEnv, "Requires configured Supabase runtime credentials.");

  test.afterAll(async () => {
    const admin = createAdminClient();

    if (createdBusinessSlugs.size > 0) {
      const { data: businesses } = await admin
        .from("businesses")
        .select("id, logo_path")
        .in("slug", [...createdBusinessSlugs]);
      const businessIds = businesses?.map((business) => business.id) ?? [];
      const logoPaths =
        businesses?.flatMap((business) =>
          business.logo_path ? [business.logo_path] : [],
        ) ?? [];

      if (businessIds.length > 0) {
        if (logoPaths.length > 0) {
          await admin.storage.from("business-logos").remove(logoPaths);
        }
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

  test("authenticated no-business user completes onboarding and reaches dashboard", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const email = testEmail(testInfo.project.name);
    const password = `Phase3-E2E-${randomUUID()}-A1`;
    await createConfirmedUser(email, password);

    const slug = `phase3-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
    createdBusinessSlugs.add(slug);

    await installBusinessLogoTransportObserver(page);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Create business" })).toBeVisible();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });

    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const responsiveViewports = [
      { width: 320, height: 568 },
      { width: 360, height: 800 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
    ] as const;

    for (const viewport of responsiveViewports) {
      await page.setViewportSize(viewport);
      await expectNoHorizontalOverflow(page);
      await expectCreateFormAlignment(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, `empty-${viewport.width}.png`),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const mobileBottomSpacing = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>("main");
      if (!workspace) return null;
      return Number.parseFloat(getComputedStyle(workspace).paddingBottom);
    });
    expect(mobileBottomSpacing).not.toBeNull();
    expect(mobileBottomSpacing!).toBeGreaterThanOrEqual(16);
    await expect(
      page.getByRole("navigation", { name: "Mobile vendor navigation" }),
    ).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.getByLabel("Business name").fill("Phase 3 E2E Bakery");
    await page.getByLabel("Description").fill("E2E onboarding verification.");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotDirectory, "partial-390.png"),
      fullPage: true,
    });
    await page.getByLabel("Business slug").fill(slug);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Bakery" }).click();
    await page.getByLabel("Phone").fill("+353 01 555 0199");
    await page.getByLabel("Business email").fill("bakery@example.com");
    await page.getByLabel("WhatsApp").fill("+353 01 555 0188");
    await page.getByLabel("Instagram").fill("@phase3e2e");
    await page.getByLabel("Address").fill("Dublin");

    await page.getByRole("button", { name: "Create business" }).click();
    await expect(
      page.getByText("Choose a business logo before creating your business."),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotDirectory, "validation-390.png"),
      fullPage: true,
    });
    const admin = createAdminClient();
    const { count: businessCountWithoutLogo } = await admin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    expect(businessCountWithoutLogo).toBe(0);

    const previewLogo = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 4,
        background: { r: 31, g: 100, b: 82, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await page.getByLabel("Logo image").setInputFiles({
      name: "selected-logo-preview.png",
      mimeType: "image/png",
      buffer: previewLogo,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(screenshotDirectory, "selected-logo-390.png"),
      fullPage: true,
    });
    await page.getByLabel("Logo image").setInputFiles([]);

    await page.getByLabel("Logo image").setInputFiles({
      name: "not-an-image.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    const createButton = page.getByRole("button", { name: "Create business" });
    const settledButtonBox = await createButton.boundingBox();
    let delayedCreationRequest = false;
    await page.route("**/onboarding", async (route) => {
      if (route.request().method() === "POST" && !delayedCreationRequest) {
        delayedCreationRequest = true;
        await new Promise((resolve) => setTimeout(resolve, 4_000));
      }
      await route.continue();
    });
    await createButton.click({ noWaitAfter: true });
    const pendingButton = page.getByRole("button", { name: "Please wait..." });
    await expect(pendingButton).toBeVisible();
    await expect(pendingButton).toBeDisabled();
    const pendingButtonBox = await pendingButton.boundingBox();
    expect(settledButtonBox).not.toBeNull();
    expect(pendingButtonBox).not.toBeNull();
    expect(pendingButtonBox!.width).toBeCloseTo(settledButtonBox!.width, 0);
    expect(pendingButtonBox!.height).toBeCloseTo(settledButtonBox!.height, 0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({
      path: path.join(screenshotDirectory, "pending-390.png"),
    });
    await expect(
      page.getByText("The uploaded file is not a valid supported image."),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/onboarding/);

    const { data: stagedBusiness } = await admin
      .from("businesses")
      .select("id, logo_path, onboarding_completed_at")
      .eq("slug", slug)
      .single();
    expect(stagedBusiness).not.toBeNull();
    if (!stagedBusiness) throw new Error("Staged business was not created.");
    expect(stagedBusiness.logo_path).toBeNull();
    expect(new Date(stagedBusiness.onboarding_completed_at).getTime()).toBe(0);

    await page.context().clearCookies({
      name: "my-customers-pending-business-onboarding",
    });
    await page.reload();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByText("Business details saved. Upload the required logo to finish setup."),
    ).toBeVisible();

    const logo = await createCameraLogoJpeg(MAX_BUSINESS_LOGO_SOURCE_BYTES);
    const uploadRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes(`/api/businesses/${stagedBusiness.id}/logo`),
    );
    await page.getByLabel("Logo image").setInputFiles({
      name: "phase3-phone-logo.jpg",
      mimeType: "image/jpeg",
      buffer: logo,
    });
    await uploadRequestPromise;
    const requestBodySize = await readObservedBusinessLogoTransportBytes(page);
    expect(requestBodySize).not.toBeNull();
    expect(requestBodySize).toBeGreaterThan(0);
    expect(requestBodySize!).toBeLessThanOrEqual(
      MAX_BUSINESS_LOGO_TRANSPORT_BYTES + 64 * 1024,
    );
    expect(requestBodySize!).toBeLessThan(4 * 1024 * 1024);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open business profile" })).toHaveText(
      "Phase 3 E2E Bakery",
    );

    const { data: completedBusiness } = await admin
      .from("businesses")
      .select("id, logo_path, onboarding_completed_at")
      .eq("slug", slug)
      .single();
    expect(completedBusiness).not.toBeNull();
    if (!completedBusiness) throw new Error("Completed business was not found.");
    expect(completedBusiness.id).toBe(stagedBusiness.id);
    expect(completedBusiness.logo_path).toBe(`${completedBusiness.id}/logo.webp`);
    expect(new Date(completedBusiness.onboarding_completed_at).getTime()).toBeGreaterThan(
      0,
    );

    const { data: storedLogo, error: storedLogoError } = await admin.storage
      .from("business-logos")
      .download(completedBusiness.logo_path);
    expect(storedLogoError).toBeNull();
    expect(storedLogo).not.toBeNull();
    const storedLogoBuffer = Buffer.from(await storedLogo!.arrayBuffer());
    const storedLogoMetadata = await sharp(storedLogoBuffer).metadata();
    expect(storedLogoMetadata.format).toBe("webp");
    expect(storedLogoMetadata.width).toBe(384);
    expect(storedLogoMetadata.height).toBe(512);
    expect(storedLogoBuffer.byteLength).toBeLessThanOrEqual(200 * 1024);
    const { data: storedLogoObjects } = await admin.storage
      .from("business-logos")
      .list(completedBusiness.id);
    expect(storedLogoObjects?.map((object) => object.name)).toEqual(["logo.webp"]);
    const {
      data: { publicUrl },
    } = admin.storage.from("business-logos").getPublicUrl(completedBusiness.logo_path);
    expect((await fetch(publicUrl)).ok).toBe(true);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
