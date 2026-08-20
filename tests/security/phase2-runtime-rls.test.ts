import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database, Json } from "@/types/database";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Phase 2",
  storagePrefix: "phase2-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;
const requiredEnv = runtime.requiredEnv;
const createSupabaseClient = runtime.createSupabaseClient;

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  id: string;
  email: string;
  password: string;
  client: AppClient;
};
type BusinessFixture = {
  id: string;
  name: string;
};

if (runtimeVerificationEnabled) {
  describe("Phase 2 runtime tenant security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase2v_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase2v-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase2v-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 2V ${label}`,
        },
      });

      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
      const id = data.user!.id;
      createdUserIds.push(id);

      const client = createSupabaseClient(publishableKey);
      const { data: signInData, error: signInError } =
        await client.auth.signInWithPassword({
          email,
          password,
        });

      expect(signInError).toBeNull();
      expect(signInData.session?.access_token).toBeTruthy();

      return { id, email, password, client };
    }

    async function createBusiness(
      ownerUserId: string,
      label: string,
    ): Promise<BusinessFixture> {
      const name = `Phase 2V ${label} ${fixtureId}`;
      const slug = `phase2v-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name,
          slug,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: ownerUserId,
        })
        .select("id, name")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBusinessIds.push(data!.id);

      return data!;
    }

    async function createMembership(
      businessId: string,
      userId: string,
      role: "owner" | "member",
    ) {
      const { error } = await service.from("business_members").insert({
        business_id: businessId,
        user_id: userId,
        role,
        status: "active",
      });

      expect(error).toBeNull();
    }

    async function assertVisibleBusiness(client: AppClient, business: BusinessFixture) {
      const { data, error } = await client
        .from("businesses")
        .select("id, name")
        .eq("id", business.id)
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({ id: business.id, name: business.name });
    }

    async function assertHiddenBusiness(client: AppClient, businessId: string) {
      const { data, error } = await client
        .from("businesses")
        .select("id")
        .eq("id", businessId);

      expect(error).toBeNull();
      expectNoRows(data);
    }

    it("proves profile provisioning, tenant isolation, grants, constraints, and audit boundaries", async () => {
      const userA = await createConfirmedUser("user-a");
      const userB = await createConfirmedUser("user-b");
      const userCNoBusiness = await createConfirmedUser("user-c-no-business");
      const userDMember = await createConfirmedUser("user-d-member");

      const businessA = await createBusiness(userA.id, "Business A");
      const businessB = await createBusiness(userB.id, "Business B");

      await createMembership(businessA.id, userA.id, "owner");
      await createMembership(businessB.id, userB.id, "owner");
      await createMembership(businessA.id, userDMember.id, "member");

      const {
        data: profileA,
        error: profileAError,
        count: profileACount,
      } = await service
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("id", userA.id);
      expect(profileAError).toBeNull();
      expect(profileA).toEqual([{ id: userA.id }]);
      expect(profileACount).toBe(1);

      await assertVisibleBusiness(userA.client, businessA);
      await assertVisibleBusiness(userB.client, businessB);
      await assertVisibleBusiness(userDMember.client, businessA);
      await assertHiddenBusiness(userA.client, businessB.id);
      await assertHiddenBusiness(userB.client, businessA.id);
      await assertHiddenBusiness(userCNoBusiness.client, businessA.id);

      const { data: userAMemberships, error: userAMembershipsError } = await userA.client
        .from("business_members")
        .select("business_id, user_id, role, status")
        .order("created_at", { ascending: true });
      expect(userAMembershipsError).toBeNull();
      expect(userAMemberships?.every((row) => row.business_id === businessA.id)).toBe(
        true,
      );
      expect(
        userAMemberships?.some((row) => row.user_id === userA.id && row.role === "owner"),
      ).toBe(true);
      expect(userAMemberships?.some((row) => row.business_id === businessB.id)).toBe(
        false,
      );

      const updatedBusinessAName = `${businessA.name} updated`;
      const { data: ownerUpdateData, error: ownerUpdateError } = await userA.client
        .from("businesses")
        .update({ name: updatedBusinessAName })
        .eq("id", businessA.id)
        .select("id, name");
      expect(ownerUpdateError).toBeNull();
      expect(ownerUpdateData).toEqual([{ id: businessA.id, name: updatedBusinessAName }]);
      businessA.name = updatedBusinessAName;

      const { data: memberUpdateData, error: memberUpdateError } =
        await userDMember.client
          .from("businesses")
          .update({ name: `${businessA.name} member overwrite` })
          .eq("id", businessA.id)
          .select("id");
      expect(memberUpdateError).toBeNull();
      expectNoRows(memberUpdateData);

      const attemptedCrossTenantName = `${businessB.name} cross tenant overwrite`;
      const { data: crossTenantUpdateData, error: crossTenantUpdateError } =
        await userA.client
          .from("businesses")
          .update({ name: attemptedCrossTenantName })
          .eq("id", businessB.id)
          .select("id");
      expect(crossTenantUpdateError).toBeNull();
      expectNoRows(crossTenantUpdateData);

      const attemptedInverseCrossTenantName = `${businessA.name} inverse overwrite`;
      const {
        data: inverseCrossTenantUpdateData,
        error: inverseCrossTenantUpdateError,
      } = await userB.client
        .from("businesses")
        .update({ name: attemptedInverseCrossTenantName })
        .eq("id", businessA.id)
        .select("id");
      expect(inverseCrossTenantUpdateError).toBeNull();
      expectNoRows(inverseCrossTenantUpdateData);

      const { data: unchangedBusinessB, error: unchangedBusinessBError } = await service
        .from("businesses")
        .select("name")
        .eq("id", businessB.id)
        .single();
      expect(unchangedBusinessBError).toBeNull();
      expect(unchangedBusinessB?.name).toBe(businessB.name);

      const { error: unauthorizedMembershipInsertError } = await userA.client
        .from("business_members")
        .insert({
          business_id: businessB.id,
          user_id: userA.id,
          role: "owner",
          status: "active",
        });
      expect(unauthorizedMembershipInsertError).not.toBeNull();

      const {
        data: unauthorizedMembershipUpdateData,
        error: unauthorizedMembershipUpdateError,
      } = await userA.client
        .from("business_members")
        .update({ role: "owner" })
        .eq("business_id", businessB.id)
        .eq("user_id", userB.id)
        .select("id");
      if (unauthorizedMembershipUpdateError === null) {
        expectNoRows(unauthorizedMembershipUpdateData);
      }

      const { error: duplicateMembershipError } = await service
        .from("business_members")
        .insert({
          business_id: businessA.id,
          user_id: userA.id,
          role: "owner",
          status: "active",
        });
      expect(duplicateMembershipError).not.toBeNull();

      const { error: invalidRoleError } = await service.from("business_members").insert({
        business_id: businessA.id,
        user_id: userCNoBusiness.id,
        role: "admin" as never,
        status: "active",
      });
      expect(invalidRoleError).not.toBeNull();

      const { error: inactiveStatusError } = await service
        .from("business_members")
        .insert({
          business_id: businessA.id,
          user_id: userCNoBusiness.id,
          role: "member",
          status: "inactive" as never,
        });
      expect(inactiveStatusError).not.toBeNull();

      const { error: invalidMetadataError } = await service.from("audit_logs").insert({
        actor_user_id: userA.id,
        business_id: businessA.id,
        event_type: "AUTH_LOGIN",
        metadata: [] as never,
      });
      expect(invalidMetadataError).not.toBeNull();

      const { data: ownProfile, error: ownProfileError } = await userA.client
        .from("profiles")
        .select("id, display_name")
        .eq("id", userA.id)
        .single();
      expect(ownProfileError).toBeNull();
      expect(ownProfile?.id).toBe(userA.id);

      const { data: otherProfile, error: otherProfileError } = await userA.client
        .from("profiles")
        .select("id")
        .eq("id", userB.id);
      expect(otherProfileError).toBeNull();
      expectNoRows(otherProfile);

      const { data: otherProfileUpdateData, error: otherProfileUpdateError } =
        await userA.client
          .from("profiles")
          .update({ display_name: "Unauthorized edit" })
          .eq("id", userB.id)
          .select("id");
      expect(otherProfileUpdateError).toBeNull();
      expectNoRows(otherProfileUpdateData);

      const { error: ownProfileIdChangeError } = await userA.client
        .from("profiles")
        .update({ id: userB.id })
        .eq("id", userA.id);
      expect(ownProfileIdChangeError).not.toBeNull();

      const anon = createSupabaseClient(publishableKey);
      for (const table of [
        "profiles",
        "businesses",
        "business_members",
        "audit_logs",
      ] as const) {
        const { data, error } = await anon.from(table).select("*").limit(1);
        if (error === null) {
          expectNoRows(data);
        }
      }

      const { error: anonBusinessInsertError } = await anon.from("businesses").insert({
        name: `Anon ${fixtureId}`,
        slug: `anon-${randomUUID().slice(0, 8)}`,
        category: "Other",
        onboarding_completed_at: new Date().toISOString(),
        created_by: userA.id,
      });
      expect(anonBusinessInsertError).not.toBeNull();

      const { error: userAuditInsertError } = await userA.client
        .from("audit_logs")
        .insert({
          actor_user_id: userA.id,
          business_id: businessA.id,
          event_type: "AUTH_LOGIN",
          metadata: { source: "browser_user_attempt" },
        });
      expect(userAuditInsertError).not.toBeNull();

      const { data: userAuditSelectData, error: userAuditSelectError } =
        await userA.client.from("audit_logs").select("id").limit(1);
      if (userAuditSelectError === null) {
        expectNoRows(userAuditSelectData);
      }

      const { data: userAuditUpdateData, error: userAuditUpdateError } =
        await userA.client
          .from("audit_logs")
          .update({ metadata: { source: "browser_user_update_attempt" } } as never)
          .eq("actor_user_id", userA.id)
          .select("id");
      if (userAuditUpdateError === null) {
        expectNoRows(userAuditUpdateData);
      }

      const { data: userAuditDeleteData, error: userAuditDeleteError } =
        await userA.client
          .from("audit_logs")
          .delete()
          .eq("actor_user_id", userA.id)
          .select("id");
      if (userAuditDeleteError === null) {
        expectNoRows(userAuditDeleteData);
      }

      const auditMetadata = {
        source: "phase2_runtime_verification",
        fixture_id: fixtureId,
      } satisfies Json;
      const { data: serverAuditData, error: serverAuditError } = await service
        .from("audit_logs")
        .insert({
          actor_user_id: userA.id,
          business_id: businessA.id,
          event_type: "AUTH_LOGIN",
          metadata: auditMetadata,
        })
        .select("id")
        .single();
      expect(serverAuditError).toBeNull();
      expect(serverAuditData?.id).toBeTruthy();

      const { data: auditRows, error: auditRowsError } = await service
        .from("audit_logs")
        .select("metadata")
        .in("actor_user_id", createdUserIds);
      expect(auditRowsError).toBeNull();
      const auditPayload = JSON.stringify(auditRows ?? []);
      expect(auditPayload).not.toContain(userA.password);
      expect(auditPayload).not.toMatch(
        /access_token|refresh_token|service_role|password/i,
      );

      const { data: helperRpcData, error: helperRpcError } = await userA.client.rpc(
        "is_business_member" as never,
        { target_business_id: businessB.id } as never,
      );
      expect(helperRpcError).not.toBeNull();
      expect(helperRpcData).toBeNull();
    }, 120_000);

    afterAll(async () => {
      if (createdUserIds.length > 0) {
        await service.from("audit_logs").delete().in("actor_user_id", createdUserIds);
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
  describe.skip("Phase 2 runtime tenant security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
