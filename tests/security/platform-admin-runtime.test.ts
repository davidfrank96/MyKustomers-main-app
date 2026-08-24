import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin foundation",
  storagePrefix: "platform-admin-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  id: string;
  email: string;
  password: string;
  client: AppClient;
};

if (runtimeVerificationEnabled) {
  describe("platform admin runtime authorization", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `pa-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const platformAuditIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `${fixtureId}-${label}@example.com`.toLowerCase();
      const password = `Admin-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Admin test ${label}` },
      });
      expect(error).toBeNull();
      const id = data.user!.id;
      createdUserIds.push(id);

      const client = runtime.createSupabaseClient(publishableKey);
      let signInError = null;
      for (const delay of [0, 2_000, 4_000, 8_000, 16_000]) {
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        const result = await client.auth.signInWithPassword({ email, password });
        signInError = result.error;
        if (!signInError || signInError.status !== 429) break;
      }
      expect(signInError).toBeNull();
      return { id, email, password, client };
    }

    async function createOwnedBusiness(owner: UserFixture, label: string) {
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `${fixtureId} ${label}`,
          slug: `${fixtureId}-${label}-${randomUUID().slice(0, 8)}`.toLowerCase(),
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: owner.id,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      createdBusinessIds.push(data!.id);
      const { error: membershipError } = await service.from("business_members").insert({
        business_id: data!.id,
        user_id: owner.id,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();
    }

    async function expectNoAdminAccess(client: AppClient) {
      const { data, error } = await client.rpc("get_my_platform_admin");
      expect(error).toBeNull();
      expectNoRows(data);
    }

    it("separates tenant ownership from active platform authority and denies self-promotion", async () => {
      const ordinary = await createUser("ordinary");
      const activeAdmin = await createUser("active-admin");

      await expectNoAdminAccess(ordinary.client);
      await createOwnedBusiness(ordinary, "one");
      await expectNoAdminAccess(ordinary.client);
      await createOwnedBusiness(ordinary, "multi");
      await expectNoAdminAccess(ordinary.client);

      const { error: adminInsertError } = await service.from("platform_admins").insert({
        user_id: activeAdmin.id,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      expect(adminInsertError).toBeNull();

      const { data: activeAccess, error: activeAccessError } =
        await activeAdmin.client.rpc("get_my_platform_admin");
      expect(activeAccessError).toBeNull();
      expect(activeAccess).toEqual([
        { user_id: activeAdmin.id, role: "SUPER_ADMIN", status: "ACTIVE" },
      ]);

      const { data: directRead, error: directReadError } = await activeAdmin.client
        .from("platform_admins")
        .select("user_id, role, status");
      if (directReadError === null) expectNoRows(directRead);

      const { error: selfInsertError } = await ordinary.client
        .from("platform_admins")
        .insert({
          user_id: ordinary.id,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        });
      expect(selfInsertError).not.toBeNull();

      const { error: metadataError } = await ordinary.client.auth.updateUser({
        data: { role: "SUPER_ADMIN", platform_admin: true, is_admin: true },
      });
      expect(metadataError).toBeNull();
      await expectNoAdminAccess(ordinary.client);

      const anon = runtime.createSupabaseClient(publishableKey);
      const { error: anonRpcError } = await anon.rpc("get_my_platform_admin");
      expect(anonRpcError).not.toBeNull();
      const { data: anonRows, error: anonReadError } = await anon
        .from("platform_admins")
        .select("user_id");
      if (anonReadError === null) expectNoRows(anonRows);

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      await expectNoAdminAccess(activeAdmin.client);

      const { data: selfUpdate, error: selfUpdateError } = await activeAdmin.client
        .from("platform_admins")
        .update({ status: "ACTIVE" })
        .eq("user_id", activeAdmin.id)
        .select("user_id");
      if (selfUpdateError === null) expectNoRows(selfUpdate);
      await expectNoAdminAccess(activeAdmin.client);

      const { error: reactivateError } = await service
        .from("platform_admins")
        .update({ status: "ACTIVE" })
        .eq("user_id", activeAdmin.id);
      expect(reactivateError).toBeNull();
      const { data: reactivatedAccess, error: reactivatedAccessError } =
        await activeAdmin.client.rpc("get_my_platform_admin");
      expect(reactivatedAccessError).toBeNull();
      expect(reactivatedAccess).toHaveLength(1);

      const { error: redisableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(redisableError).toBeNull();
      await expectNoAdminAccess(activeAdmin.client);

      const { data: auditRows, error: auditError } = await service
        .from("audit_logs")
        .select("id, actor_user_id, business_id, event_type, metadata")
        .in("event_type", [
          "PLATFORM_ADMIN_CREATED",
          "PLATFORM_ADMIN_UPDATED",
          "PLATFORM_ADMIN_DISABLED",
        ])
        .gte("created_at", new Date(Date.now() - 120_000).toISOString());
      expect(auditError).toBeNull();
      const fixtureAudits = (auditRows ?? []).filter((row) =>
        createdUserIds.includes(String((row.metadata as Record<string, unknown>).target_user_id)),
      );
      platformAuditIds.push(...fixtureAudits.map((row) => row.id));
      expect(fixtureAudits.filter((row) => row.event_type === "PLATFORM_ADMIN_CREATED"))
        .toHaveLength(1);
      expect(fixtureAudits.some((row) => row.event_type === "PLATFORM_ADMIN_DISABLED"))
        .toBe(true);
      expect(fixtureAudits.some((row) => row.event_type === "PLATFORM_ADMIN_UPDATED"))
        .toBe(true);
      expect(fixtureAudits.every((row) => row.business_id === null)).toBe(true);
      expect(JSON.stringify(fixtureAudits)).not.toMatch(
        /password|access_token|refresh_token|service_role/i,
      );
    }, 120_000);

    afterAll(async () => {
      if (platformAuditIds.length > 0) {
        await service.from("audit_logs").delete().in("id", platformAuditIds);
      }
      if (createdUserIds.length > 0) {
        await service.from("platform_admins").delete().in("user_id", createdUserIds);
      }
      if (createdBusinessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", createdBusinessIds);
        await service.from("businesses").delete().in("id", createdBusinessIds);
      }
      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    });
  });
}

if (!runtimeVerificationEnabled) {
  describe.skip("platform admin runtime authorization", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
