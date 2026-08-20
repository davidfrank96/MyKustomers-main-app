import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Phase 4",
  storagePrefix: "phase4-runtime",
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

if (runtimeVerificationEnabled) {
  describe("Phase 4 customer runtime tenant security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase4_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase4-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase4-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 4 ${label}`,
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

    async function createBusiness(ownerUserId: string, label: string) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const slug = `phase4-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 4 ${label}`,
          slug,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: ownerUserId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBusinessIds.push(data!.id);

      const { error: membershipError } = await service.from("business_members").insert({
        business_id: data!.id,
        user_id: ownerUserId,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();

      return data!.id;
    }

    async function createCustomer(client: AppClient, businessId: string, label: string) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data, error } = await client
        .from("customers")
        .insert({
          business_id: businessId,
          name: `Phase 4 ${label}`,
          email: `${safeLabel}-${Date.now()}@example.com`,
          phone: "+353 01 555 0101",
          notes: "Runtime customer",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdCustomerIds.push(data!.id);
      return data!.id;
    }

    it("enforces tenant-scoped customer read, write, archive, and search", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const memberA = await createConfirmedUser("member-a");

      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");

      const { error: memberError } = await service.from("business_members").insert({
        business_id: businessAId,
        user_id: memberA.id,
        role: "member",
        status: "active",
      });
      expect(memberError).toBeNull();

      const customerAId = await createCustomer(userA.client, businessAId, "Customer A");
      const customerBId = await createCustomer(userB.client, businessBId, "Needle Customer B");

      const { data: userAOwn, error: userAOwnError } = await userA.client
        .from("customers")
        .select("id, name")
        .eq("id", customerAId)
        .single();
      expect(userAOwnError).toBeNull();
      expect(userAOwn?.id).toBe(customerAId);

      const { data: userACross, error: userACrossError } = await userA.client
        .from("customers")
        .select("id")
        .eq("id", customerBId);
      expect(userACrossError).toBeNull();
      expectNoRows(userACross);

      const { data: userBCross, error: userBCrossError } = await userB.client
        .from("customers")
        .select("id")
        .eq("id", customerAId);
      expect(userBCrossError).toBeNull();
      expectNoRows(userBCross);

      const { error: unauthorizedCreateError } = await userA.client.from("customers").insert({
        business_id: businessBId,
        name: "Unauthorized create",
      });
      expect(unauthorizedCreateError).not.toBeNull();

      const { data: userAUpdateB, error: userAUpdateBError } = await userA.client
        .from("customers")
        .update({ notes: "Cross-tenant edit" })
        .eq("id", customerBId)
        .select("id");
      expect(userAUpdateBError).toBeNull();
      expectNoRows(userAUpdateB);

      const { data: userBUpdateA, error: userBUpdateAError } = await userB.client
        .from("customers")
        .update({ notes: "Cross-tenant edit" })
        .eq("id", customerAId)
        .select("id");
      expect(userBUpdateAError).toBeNull();
      expectNoRows(userBUpdateA);

      const { error: reassignmentError } = await userA.client
        .from("customers")
        .update({ business_id: businessBId })
        .eq("id", customerAId);
      expect(reassignmentError).not.toBeNull();

      const { data: memberCustomer, error: memberCustomerError } = await memberA.client
        .from("customers")
        .insert({
          business_id: businessAId,
          name: "Phase 4 Member Customer",
          phone: "+353 01 555 0102",
        })
        .select("id")
        .single();
      expect(memberCustomerError).toBeNull();
      expect(memberCustomer?.id).toBeTruthy();
      createdCustomerIds.push(memberCustomer!.id);

      const { data: memberUpdate, error: memberUpdateError } = await memberA.client
        .from("customers")
        .update({ notes: "Member update allowed." })
        .eq("id", customerAId)
        .select("id, notes");
      expect(memberUpdateError).toBeNull();
      expect(memberUpdate).toEqual([{ id: customerAId, notes: "Member update allowed." }]);

      const archivedAt = new Date().toISOString();
      const { data: memberArchive, error: memberArchiveError } = await memberA.client
        .from("customers")
        .update({ archived_at: archivedAt })
        .eq("id", customerAId)
        .select("id, archived_at");
      expect(memberArchiveError).toBeNull();
      expect(memberArchive?.[0]?.id).toBe(customerAId);
      expect(memberArchive?.[0]?.archived_at).toBeTruthy();

      const { data: userBArchivedCross, error: userBArchivedCrossError } =
        await userB.client.from("customers").select("id").eq("id", customerAId);
      expect(userBArchivedCrossError).toBeNull();
      expectNoRows(userBArchivedCross);

      const { data: searchLeak, error: searchLeakError } = await userA.client
        .from("customers")
        .select("id, name")
        .or("name.ilike.%Needle Customer B%,email.ilike.%Needle Customer B%,phone.ilike.%Needle Customer B%");
      expect(searchLeakError).toBeNull();
      expect(searchLeak?.some((row) => row.id === customerBId)).toBe(false);

      const anon = createSupabaseClient(publishableKey);
      const { data: anonSelect, error: anonSelectError } = await anon
        .from("customers")
        .select("id")
        .limit(1);
      if (anonSelectError === null) {
        expectNoRows(anonSelect);
      }

      const { error: anonInsertError } = await anon.from("customers").insert({
        business_id: businessAId,
        name: "Anon customer",
      });
      expect(anonInsertError).not.toBeNull();

      const { data: anonUpdate, error: anonUpdateError } = await anon
        .from("customers")
        .update({ name: "Anon update" })
        .eq("id", customerAId)
        .select("id");
      if (anonUpdateError === null) {
        expectNoRows(anonUpdate);
      }
    }, 120_000);

    afterAll(async () => {
      if (createdCustomerIds.length > 0) {
        await service.from("customers").delete().in("id", createdCustomerIds);
      }

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
  describe.skip("Phase 4 customer runtime tenant security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
