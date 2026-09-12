import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { expect, test } from "./support/test";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "../../features/confirmation-links/token";

function loadLocalEnv() {
  if (!fs.existsSync(".env")) return;

  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    process.env[line.slice(0, separatorIndex)] ??= line.slice(separatorIndex + 1);
  }
}

loadLocalEnv();

const hasRuntimeEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        storageKey: `confirmation-hotfix-${randomUUID()}`,
      },
    },
  );
}

test.describe("customer confirmation trust and success hotfix", () => {
  test.skip(!hasRuntimeEnv, "Requires configured Supabase runtime credentials.");

  test("keeps crawler metadata vendor-bound and renders a stable terminal success", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = createAdminClient();
    const fixture = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const email = `confirmation-hotfix-${fixture}@example.com`;
    const confirmedEmail = `Customer.${fixture}@example.com`;
    const businessName = `Confirmation Studio ${fixture}`;
    const token = generateConfirmationToken();
    let userId: string | null = null;
    let businessId: string | null = null;
    let logoPath: string | null = null;

    try {
      const { data: userData, error: userError } =
        await admin.auth.admin.createUser({
          email,
          password: `Confirmation-${randomUUID()}-A1`,
          email_confirm: true,
        });
      expect(userError).toBeNull();
      userId = userData.user!.id;

      const { data: business, error: businessError } = await admin
        .from("businesses")
        .insert({
          name: businessName,
          slug: `confirmation-hotfix-${fixture}`,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      businessId = business!.id;
      logoPath = `${businessId}/logo.webp`;

      const logo = await sharp({
        create: {
          width: 480,
          height: 240,
          channels: 4,
          background: { r: 13, g: 107, b: 82, alpha: 1 },
        },
      })
        .webp({ quality: 80 })
        .toBuffer();
      const { error: logoError } = await admin.storage
        .from("business-logos")
        .upload(logoPath, logo, { contentType: "image/webp", upsert: true });
      expect(logoError).toBeNull();
      expect(
        (
          await admin
            .from("businesses")
            .update({ logo_path: logoPath })
            .eq("id", businessId)
        ).error,
      ).toBeNull();

      const { data: customer, error: customerError } = await admin
        .from("customers")
        .insert({
          business_id: businessId,
          name: `Private Customer ${fixture}`,
          email: null,
          phone: null,
        })
        .select("id")
        .single();
      expect(customerError).toBeNull();

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customer!.id,
          title: `Private Booking ${fixture}`,
          description: "Private confirmation details",
          currency: "EUR",
          total_amount_minor: 42_000,
          deposit_amount_minor: 10_000,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Never expose this note",
          status: "AWAITING_CUSTOMER",
          created_by: userId,
        })
        .select("id")
        .single();
      expect(bookingError).toBeNull();

      const { error: linkError } = await admin.from("confirmation_links").insert({
        business_id: businessId,
        booking_id: booking!.id,
        token_hash: hashConfirmationToken(token),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        created_by: userId,
      });
      expect(linkError).toBeNull();

      const confirmationUrl = `/c/${token}`;
      const crawlerResponse = await page.request.get(confirmationUrl, {
        headers: { "user-agent": "facebookexternalhit/1.1" },
      });
      expect(crawlerResponse.ok()).toBe(true);
      const crawlerHtml = await crawlerResponse.text();
      const crawlerHead = crawlerHtml.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? "";
      expect(crawlerHtml).toContain(`Confirm your booking with ${businessName}`);
      expect(crawlerHead).toContain("https://mykustomers.com/social/confirmation/");
      expect(crawlerHead).toContain('property="og:image:type" content="image/png"');
      expect(crawlerHead.match(/property="og:image"/g)).toHaveLength(1);
      expect(crawlerHtml).not.toContain(`Private Customer ${fixture}`);
      expect(crawlerHtml).not.toContain(`Private Booking ${fixture}`);
      expect(crawlerHtml).not.toContain("Never expose this note");
      expect(crawlerHead).not.toContain(token);

      const { data: afterCrawler } = await admin
        .from("confirmation_links")
        .select("first_opened_at, used_at")
        .eq("token_hash", hashConfirmationToken(token))
        .single();
      expect(afterCrawler).toEqual({ first_opened_at: null, used_at: null });

      const openRecorded = page.waitForResponse(
        (response) =>
          response.url().includes("/api/confirmation/open") &&
          response.request().method() === "POST",
      );
      await page.goto(confirmationUrl);
      await openRecorded;
      const emailInput = page.getByLabel("Email address");
      await emailInput.fill(confirmedEmail);
      await expect(emailInput).toHaveValue(confirmedEmail);
      await page.getByRole("button", { name: "Review and confirm" }).click();
      await page.getByRole("button", { name: "Confirm booking" }).click();

      await expect(
        page.getByRole("heading", { name: "Booking confirmed" }),
      ).toBeVisible();
      await expect(page.getByText(`sent to ${businessName}.`)).toBeVisible();
      await expect(page.getByTestId("confirmed-email")).toHaveText(confirmedEmail);
      await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
      expect(page.url()).not.toContain("confirmed=1");

      for (const viewport of [
        { width: 320, height: 568 },
        { width: 360, height: 800 },
        { width: 375, height: 812 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 1000 },
      ]) {
        await page.setViewportSize(viewport);
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
        await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
      }

      const [{ data: confirmationRows }, { data: emailEvents }, { data: profile }] =
        await Promise.all([
          admin
            .from("booking_confirmations")
            .select("contact_email")
            .eq("booking_id", booking!.id),
          admin
            .from("email_events")
            .select("recipient_email")
            .eq("booking_id", booking!.id)
            .eq("event_type", "BOOKING_CONFIRMED"),
          admin.from("customers").select("email").eq("id", customer!.id).single(),
        ]);
      expect(confirmationRows).toEqual([{ contact_email: confirmedEmail }]);
      expect(emailEvents).toEqual([{ recipient_email: confirmedEmail }]);
      expect(profile?.email).toBeNull();

      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Booking already confirmed" }),
      ).toBeVisible();
      await expect(page.getByText("You can close this page now.")).toBeVisible();
    } finally {
      if (logoPath) {
        await admin.storage.from("business-logos").remove([logoPath]);
      }
      if (businessId) {
        await admin.from("businesses").delete().eq("id", businessId);
      }
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
