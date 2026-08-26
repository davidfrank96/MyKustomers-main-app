import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseAdminHealthSummary,
  parseAdminSecurityActivity,
} from "@/features/admin/health";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin Security & Health",
  storagePrefix: "platform-admin-health-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;

if (runtimeVerificationEnabled) {
  describe("platform admin Security & Health runtime authorization", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixture = `pah-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];

    async function createUser(label: string) {
      const email = `${fixture}-${label}@example.com`.toLowerCase();
      const password = `Admin-Health-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Admin health ${label}` },
      });
      expect(error).toBeNull();
      createdUserIds.push(data.user!.id);

      const client = runtime.createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();
      return { id: data.user!.id, client };
    }

    async function expectDenied(client: AppClient) {
      const [summary, activity] = await Promise.all([
        client.rpc("get_platform_admin_health_summary"),
        client.rpc("get_platform_admin_security_activity", { p_limit: 12 }),
      ]);
      expect(summary.error).not.toBeNull();
      expect(activity.error).not.toBeNull();
    }

    async function operationalSnapshot() {
      const [emails, attempts, issues, bookings] = await Promise.all([
        service.from("email_events").select("id,status,attempt_count").order("id"),
        service.from("email_delivery_attempts").select("id,status").order("id"),
        service.from("booking_issues").select("id,status").order("id"),
        service.from("bookings").select("id,status").order("id"),
      ]);
      for (const result of [emails, attempts, issues, bookings]) {
        expect(result.error).toBeNull();
      }
      return {
        emails: emails.data,
        attempts: attempts.data,
        issues: issues.data,
        bookings: bookings.data,
      };
    }

    it("allows AAL1 active admins while denying every non-platform authority", async () => {
      const ordinary = await createUser("ordinary");
      const owner = await createUser("owner");
      const activeAdmin = await createUser("active-admin");
      const disabledAdmin = await createUser("disabled-admin");

      const { data: business, error: businessError } = await service
        .from("businesses")
        .insert({
          name: "Admin health runtime business",
          slug: fixture,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: owner.id,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      createdBusinessIds.push(business!.id);
      const { error: membershipError } = await service.from("business_members").insert({
        business_id: business!.id,
        user_id: owner.id,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();

      const { error: adminError } = await service.from("platform_admins").insert([
        { user_id: activeAdmin.id, role: "SUPER_ADMIN", status: "ACTIVE" },
        { user_id: disabledAdmin.id, role: "SUPER_ADMIN", status: "DISABLED" },
      ]);
      expect(adminError).toBeNull();

      await expectDenied(runtime.createSupabaseClient(publishableKey));
      await expectDenied(ordinary.client);
      await expectDenied(owner.client);
      await expectDenied(disabledAdmin.client);

      const before = await operationalSnapshot();
      const [summaryResult, activityResult] = await Promise.all([
        activeAdmin.client.rpc("get_platform_admin_health_summary"),
        activeAdmin.client.rpc("get_platform_admin_security_activity", { p_limit: 20 }),
      ]);
      expect(summaryResult.error).toBeNull();
      expect(activityResult.error).toBeNull();
      expect(parseAdminHealthSummary(summaryResult.data)).not.toBeNull();
      expect(parseAdminSecurityActivity(activityResult.data)).not.toBeNull();
      expect(JSON.stringify(summaryResult.data)).not.toMatch(
        /recipient_email|customer_email|customer_phone|booking_description|internal_notes|provider_message_id|failure_message|token_hash|totp|session/i,
      );
      expect(JSON.stringify(activityResult.data)).not.toMatch(
        /recipient_email|customer_email|customer_phone|email_body|provider_message_id|failure_message|token_hash|totp|session/i,
      );
      expect(await operationalSnapshot()).toEqual(before);

      const forgedClient = ordinary.client as AppClient & {
        isAdmin?: boolean;
        role?: string;
        healthScope?: string;
      };
      forgedClient.isAdmin = true;
      forgedClient.role = "SUPER_ADMIN";
      forgedClient.healthScope = "platform";
      await expectDenied(forgedClient);
    });

    afterAll(async () => {
      const { data: audits } = await service
        .from("audit_logs")
        .select("id,metadata,business_id")
        .gte("created_at", new Date(Date.now() - 300_000).toISOString());
      const auditIds = (audits ?? [])
        .filter((row) => {
          const target = String(
            (row.metadata as Record<string, unknown>).target_user_id ?? "",
          );
          return (
            createdUserIds.includes(target) || row.business_id === createdBusinessIds[0]
          );
        })
        .map((row) => row.id);
      if (auditIds.length > 0) {
        await service.from("audit_logs").delete().in("id", auditIds);
      }
      if (createdUserIds.length > 0) {
        await service.from("platform_admins").delete().in("user_id", createdUserIds);
      }
      if (createdBusinessIds.length > 0) {
        await service.from("businesses").delete().in("id", createdBusinessIds);
      }
      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    });
  });
}

if (!runtimeVerificationEnabled) {
  describe.skip("platform admin Security & Health runtime authorization", () => {
    it("requires an explicitly safe non-production backend target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
