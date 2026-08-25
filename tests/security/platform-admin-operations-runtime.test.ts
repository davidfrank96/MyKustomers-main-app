import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseAdminBookingDetail,
  parseAdminBookingPage,
  parseAdminIssueDetail,
  parseAdminIssuePage,
} from "@/features/admin/operations";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin booking and issue operations",
  storagePrefix: "platform-admin-operations-runtime",
});
const productionReadVerificationEnabled =
  process.env.ADMIN_PHASE4_PRODUCTION_READ_VERIFICATION === "1" &&
  process.env.PHASE2_SUPABASE_TARGET === "production" &&
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
const runtimeVerificationEnabled = runtime.enabled || productionReadVerificationEnabled;

type AppClient = SupabaseClient<Database>;

if (runtimeVerificationEnabled) {
  describe("platform admin booking and issue runtime authorization", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixture = `pao-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];

    async function createUser(label: string) {
      const email = `${fixture}-${label}@example.com`;
      const password = `Admin-Operations-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Admin operations ${label}` },
      });
      expect(error).toBeNull();
      const id = data.user!.id;
      createdUserIds.push(id);

      const client = runtime.createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();
      return { client, id };
    }

    async function expectDenied(client: AppClient) {
      const results = await Promise.all([
        client.rpc("get_platform_admin_bookings", {
          p_search: fixture,
          p_filter: "all",
          p_page: 1,
          p_page_size: 20,
        }),
        client.rpc("get_platform_admin_booking", { p_booking_id: randomUUID() }),
        client.rpc("get_platform_admin_issues", {
          p_search: fixture,
          p_status: "all",
          p_category: "all",
          p_page: 1,
          p_page_size: 20,
        }),
        client.rpc("get_platform_admin_issue", { p_issue_id: randomUUID() }),
      ]);
      for (const result of results) expect(result.error).not.toBeNull();
    }

    it("allows minimized reads only for an active admin and revokes immediately", async () => {
      const ordinary = await createUser("ordinary");
      const activeAdmin = await createUser("active-admin");
      const { error: adminError } = await service.from("platform_admins").insert({
        user_id: activeAdmin.id,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      expect(adminError).toBeNull();

      await expectDenied(runtime.createSupabaseClient(publishableKey));
      await expectDenied(ordinary.client);

      const punctuation = "%_,.'\"()";
      const { data: bookingPageData, error: bookingPageError } =
        await activeAdmin.client.rpc("get_platform_admin_bookings", {
          p_search: punctuation,
          p_filter: "all",
          p_page: 1,
          p_page_size: 20,
        });
      expect(bookingPageError).toBeNull();
      expect(parseAdminBookingPage(bookingPageData)).not.toBeNull();

      const { data: allBookingsData, error: allBookingsError } =
        await activeAdmin.client.rpc("get_platform_admin_bookings", {
          p_filter: "all",
          p_page: 1,
          p_page_size: 20,
        });
      expect(allBookingsError).toBeNull();
      const bookings = parseAdminBookingPage(allBookingsData);
      expect(bookings).not.toBeNull();
      if (bookings!.items[0]) {
        const { data, error } = await activeAdmin.client.rpc(
          "get_platform_admin_booking",
          { p_booking_id: bookings!.items[0].id },
        );
        expect(error).toBeNull();
        expect(parseAdminBookingDetail(data)).not.toBeNull();
        expect(JSON.stringify(data)).not.toMatch(
          /internal_notes|token_hash|terms_hash|recipient_email|failure_message|failure_code|provider_id|private_comment/i,
        );
      }

      const { data: issuesData, error: issuesError } = await activeAdmin.client.rpc(
        "get_platform_admin_issues",
        { p_status: "all", p_category: "all", p_page: 1, p_page_size: 20 },
      );
      expect(issuesError).toBeNull();
      const issues = parseAdminIssuePage(issuesData);
      expect(issues).not.toBeNull();
      expect(JSON.stringify(issuesData)).not.toContain('"description"');
      if (issues!.items[0]) {
        const { data, error } = await activeAdmin.client.rpc("get_platform_admin_issue", {
          p_issue_id: issues!.items[0].id,
        });
        expect(error).toBeNull();
        expect(parseAdminIssueDetail(data)).not.toBeNull();
      }

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      await expectDenied(activeAdmin.client);
    });

    afterAll(async () => {
      const { data: audits } = await service
        .from("audit_logs")
        .select("id, metadata")
        .in("event_type", [
          "PLATFORM_ADMIN_CREATED",
          "PLATFORM_ADMIN_UPDATED",
          "PLATFORM_ADMIN_DISABLED",
        ])
        .gte("created_at", new Date(Date.now() - 300_000).toISOString());
      const auditIds = (audits ?? [])
        .filter((row) =>
          createdUserIds.includes(
            String((row.metadata as Record<string, unknown>).target_user_id),
          ),
        )
        .map((row) => row.id);
      if (auditIds.length > 0) await service.from("audit_logs").delete().in("id", auditIds);
      if (createdUserIds.length > 0) {
        await service.from("platform_admins").delete().in("user_id", createdUserIds);
        await Promise.allSettled(
          createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
        );
      }
    });
  });
}

if (!runtimeVerificationEnabled) {
  describe.skip("platform admin booking and issue runtime authorization", () => {
    it("is skipped until explicitly pointed at a safe target or production read gate", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
