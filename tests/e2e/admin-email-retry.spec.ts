import fs from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database, Json } from "@/types/database";

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

const canRun =
  process.env.ADMIN_PHASE6B_RUNTIME_VERIFICATION === "1" &&
  Boolean(
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
        storageKey: `admin-email-retry-e2e-${randomUUID()}`,
      },
    },
  );
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.toUpperCase().replace(/=|\s/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP enrollment secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  return Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, index) =>
      Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );
}

function currentTotp(secret: string) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    1_000_000;
  return value.toString().padStart(6, "0");
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(onboarding|dashboard)/, { timeout: 15_000 });
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test.describe("MFA-gated safe failed-email retry", () => {
  test.skip(!canRun, "Requires explicit controlled Admin Phase 6B runtime opt-in.");

  test("denies AAL1, retries once at AAL2, preserves evidence, and changes no booking state", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The viewport matrix runs once.");
    test.setTimeout(180_000);

    const service = createAdminClient();
    const marker = `phase6b-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `${marker}@example.com`;
    const password = `Phase6B-${randomUUID()}-A1`;
    const reason = "Retry after controlled temporary provider rate-limit failure.";
    const snapshot = {
      business_name: "Phase 6B Controlled Verification",
      customer_name: "Controlled Email Recipient",
      booking_reference: `P6B-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: "Controlled retry verification",
      description: "Temporary communication-only verification fixture.",
      scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
      currency: "NGN",
      total_amount_minor: 10_000,
      deposit_amount_minor: 2_000,
      balance_amount_minor: 8_000,
    } satisfies Json;
    const hash = "a".repeat(64);
    let userId: string | null = null;
    let businessId: string | null = null;
    let bookingId: string | null = null;
    let emailEventId: string | null = null;

    try {
      const { data: userData, error: userError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: "Phase 6B Controlled Admin" },
      });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const { error: adminError } = await service.from("platform_admins").insert({
        user_id: userId,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      expect(adminError).toBeNull();

      const { data: business, error: businessError } = await service
        .from("businesses")
        .insert({
          name: "Phase 6B Controlled Verification",
          slug: marker,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      businessId = business!.id;

      const { data: customer, error: customerError } = await service
        .from("customers")
        .insert({ business_id: businessId, name: "Controlled Email Recipient", email })
        .select("id")
        .single();
      expect(customerError).toBeNull();

      const { data: booking, error: bookingError } = await service
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customer!.id,
          title: snapshot.title,
          description: snapshot.description,
          currency: "NGN",
          total_amount_minor: snapshot.total_amount_minor,
          deposit_amount_minor: snapshot.deposit_amount_minor,
          scheduled_for: snapshot.scheduled_for,
          status: "DRAFT",
          created_by: userId,
        })
        .select("id, reference, status, updated_at")
        .single();
      expect(bookingError).toBeNull();
      bookingId = booking!.id;
      snapshot.booking_reference = booking!.reference;

      const linkCreatedAt = new Date().toISOString();
      const { data: link, error: linkError } = await service
        .from("confirmation_links")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          token_hash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          used_at: linkCreatedAt,
          created_by: userId,
          created_at: linkCreatedAt,
        })
        .select("id")
        .single();
      expect(linkError).toBeNull();

      const { data: confirmation, error: confirmationError } = await service
        .from("booking_confirmations")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          confirmation_link_id: link!.id,
          terms_hash: hash,
          terms_snapshot: snapshot,
          contact_email: email,
        })
        .select("id")
        .single();
      expect(confirmationError).toBeNull();

      const failedAt = new Date().toISOString();
      const { data: emailEvent, error: emailEventError } = await service
        .from("email_events")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          customer_id: customer!.id,
          booking_confirmation_id: confirmation!.id,
          event_type: "BOOKING_CONFIRMED",
          recipient_email: email,
          status: "FAILED",
          attempt_count: 1,
          failure_code: "provider_http_429",
          failure_message: "The provider rate limited the controlled attempt.",
          last_attempt_at: failedAt,
        })
        .select("id")
        .single();
      expect(emailEventError).toBeNull();
      emailEventId = emailEvent!.id;

      const { error: attemptError } = await service
        .from("email_delivery_attempts")
        .insert({
          email_event_id: emailEventId,
          attempt_number: 1,
          provider: "development",
          origin: "DOMAIN_EVENT",
          status: "FAILED",
          failure_code: "provider_http_429",
          failure_message: "The provider rate limited the controlled attempt.",
          started_at: failedAt,
          completed_at: failedAt,
        });
      expect(attemptError).toBeNull();

      await signIn(page, email, password);
      await page.goto(`/admin/emails/${emailEventId}`);
      await page.getByRole("button", { name: "Retry delivery" }).click();
      let dialog = page.getByRole("dialog", { name: "Retry this email delivery?" });
      await dialog.getByLabel("Reason").fill(reason);
      await dialog.getByRole("button", { name: "Retry delivery" }).click();
      await expect(dialog.getByText("Additional verification required.")).toBeVisible();

      const { data: deniedEvent } = await service
        .from("email_events")
        .select("status, attempt_count")
        .eq("id", emailEventId)
        .single();
      expect(deniedEvent).toEqual({ status: "FAILED", attempt_count: 1 });

      await dialog.getByRole("link", { name: "Verify in Admin security" }).click();
      await page.getByRole("button", { name: "Set up authenticator" }).click();
      const secret = (await page.locator("code").textContent())?.trim();
      expect(secret).toBeTruthy();
      await page.getByLabel("Verification code").fill(currentTotp(secret!));
      await page.getByRole("button", { name: "Verify and enable" }).click();
      await expect(page.getByText("Privileged verification active")).toBeVisible();

      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await page.goto(`/admin/emails/${emailEventId}`);
        await expect(page.getByText("Classification: Retryable")).toBeVisible();
        await page.getByRole("button", { name: "Retry delivery" }).click();
        dialog = page.getByRole("dialog", { name: "Retry this email delivery?" });
        await expect(dialog.getByLabel("Reason")).toHaveAttribute("required", "");
        await expect(dialog.getByLabel("Reason")).toHaveAttribute("maxlength", "500");
        await expectNoOverflow(page);
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }

      const competingPage = await context.newPage();
      await competingPage.goto(`/admin/emails/${emailEventId}`);
      await page.getByRole("button", { name: "Retry delivery" }).click();
      dialog = page.getByRole("dialog", { name: "Retry this email delivery?" });
      const competingDialog = competingPage.getByRole("dialog", {
        name: "Retry this email delivery?",
      });
      await competingPage.getByRole("button", { name: "Retry delivery" }).click();
      await Promise.all([
        dialog.getByLabel("Reason").fill(reason),
        competingDialog.getByLabel("Reason").fill(`${reason} Competing tab.`),
      ]);
      await Promise.all([
        dialog.getByRole("button", { name: "Retry delivery" }).click(),
        competingDialog.getByRole("button", { name: "Retry delivery" }).click(),
      ]);
      await expect
        .poll(async () => {
          const messages = await Promise.all([
            page.getByText("Delivery attempt accepted by provider.").count(),
            competingPage.getByText("Delivery attempt accepted by provider.").count(),
          ]);
          return messages.reduce((total, count) => total + count, 0);
        })
        .toBe(1);

      const { data: finalEvent } = await service
        .from("email_events")
        .select("status, attempt_count, failure_code, provider_message_id")
        .eq("id", emailEventId)
        .single();
      expect(finalEvent).toMatchObject({
        status: "SENT",
        attempt_count: 2,
        failure_code: null,
      });
      expect(finalEvent?.provider_message_id).toMatch(/^development-/);

      const { data: attempts } = await service
        .from("email_delivery_attempts")
        .select("attempt_number, provider, origin, status, requested_by, reason")
        .eq("email_event_id", emailEventId)
        .order("attempt_number");
      expect(attempts).toEqual([
        expect.objectContaining({
          attempt_number: 1,
          provider: "development",
          origin: "DOMAIN_EVENT",
          status: "FAILED",
        }),
        expect.objectContaining({
          attempt_number: 2,
          provider: "development",
          origin: "ADMIN_RETRY",
          status: "SENT",
          requested_by: userId,
          reason: expect.stringContaining(reason),
        }),
      ]);
      await competingPage.close();

      const { data: audits } = await service
        .from("audit_logs")
        .select("event_type, actor_user_id, metadata")
        .eq("business_id", businessId)
        .in("event_type", [
          "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
          "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
          "PLATFORM_ADMIN_EMAIL_RETRY_FAILED",
        ]);
      expect(audits).toHaveLength(2);
      expect(audits?.map((row) => row.event_type).sort()).toEqual([
        "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
        "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
      ]);
      expect(audits?.every((row) => row.actor_user_id === userId)).toBe(true);
      const auditText = JSON.stringify(audits);
      expect(auditText).not.toContain(email);
      expect(auditText).not.toContain("Controlled retry verification");

      const { data: unchangedBooking } = await service
        .from("bookings")
        .select("status, updated_at")
        .eq("id", bookingId)
        .single();
      expect(unchangedBooking).toEqual({
        status: booking!.status,
        updated_at: booking!.updated_at,
      });
    } finally {
      if (businessId) await service.from("audit_logs").delete().eq("business_id", businessId);
      if (emailEventId) await service.from("email_events").delete().eq("id", emailEventId);
      if (bookingId) {
        await service.from("booking_confirmations").delete().eq("booking_id", bookingId);
        await service.from("confirmation_links").delete().eq("booking_id", bookingId);
        await service.from("bookings").delete().eq("id", bookingId);
      }
      if (businessId) {
        await service.from("customers").delete().eq("business_id", businessId);
        await service.from("businesses").delete().eq("id", businessId);
      }
      if (userId) {
        await service.from("platform_admins").delete().eq("user_id", userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  });
});
