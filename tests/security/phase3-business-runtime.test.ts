import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

const safeTargets = new Set([
  "local",
  "dev",
  "development",
  "test",
  "testing",
  "staging",
]);
const runtimeVerificationEnabled =
  process.env.PHASE2_RUNTIME_VERIFICATION === "1" &&
  safeTargets.has((process.env.PHASE2_SUPABASE_TARGET ?? "").toLowerCase()) &&
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  id: string;
  email: string;
  password: string;
  client: AppClient;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Phase 3 runtime verification.`);
  }

  return value;
}

function createSupabaseClient(key: string) {
  return createClient<Database>(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `phase3-runtime-${randomUUID()}`,
    },
  });
}

if (runtimeVerificationEnabled) {
  describe("Phase 3 business onboarding runtime security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase3_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase3-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase3-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 3 ${label}`,
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

    async function createBusinessViaRpc(
      client: AppClient,
      label: string,
      slug: string,
    ) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data, error } = await client.rpc("create_business_onboarding", {
        business_name: `Phase 3 ${label} ${fixtureId}`,
        business_slug: slug,
        business_category: "Bakery",
        business_description: "Runtime verification business.",
        business_phone: "+353 01 555 0101",
        business_email: `${safeLabel}-${Date.now()}@example.com`,
        business_whatsapp: "+353 01 555 0102",
        business_instagram: `phase3_${safeLabel}`.replace(/[^a-z0-9._]/g, "_"),
        business_address_text: "Phase 3 test address",
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      createdBusinessIds.push(data!);
      return data!;
    }

    it("creates businesses atomically and preserves tenant authorization", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const member = await createConfirmedUser("member");
      const noBusiness = await createConfirmedUser("no-business");

      const businessAId = await createBusinessViaRpc(
        userA.client,
        "Business A",
        `phase3-runtime-shared-${randomUUID().slice(0, 8)}`,
      );
      const businessBId = await createBusinessViaRpc(
        userB.client,
        "Business B",
        `phase3-runtime-shared-${randomUUID().slice(0, 8)}`,
      );

      const duplicateBaseSlug = `phase3-duplicate-${randomUUID().slice(0, 8)}`;
      const duplicateOneId = await createBusinessViaRpc(
        noBusiness.client,
        "Duplicate One",
        duplicateBaseSlug,
      );
      const duplicateTwoId = await createBusinessViaRpc(
        member.client,
        "Duplicate Two",
        duplicateBaseSlug,
      );

      const { data: duplicateBusinesses, error: duplicateBusinessesError } = await service
        .from("businesses")
        .select("id, slug")
        .in("id", [duplicateOneId, duplicateTwoId])
        .order("slug", { ascending: true });
      expect(duplicateBusinessesError).toBeNull();
      expect(duplicateBusinesses?.map((row) => row.slug).sort()).toEqual([
        duplicateBaseSlug,
        `${duplicateBaseSlug}-2`,
      ]);

      const { data: ownerMembership, error: ownerMembershipError } = await service
        .from("business_members")
        .select("business_id, user_id, role, status")
        .eq("business_id", businessAId)
        .eq("user_id", userA.id)
        .single();
      expect(ownerMembershipError).toBeNull();
      expect(ownerMembership).toEqual({
        business_id: businessAId,
        user_id: userA.id,
        role: "owner",
        status: "active",
      });

      const { data: auditRows, error: auditRowsError } = await service
        .from("audit_logs")
        .select("event_type")
        .eq("business_id", businessAId)
        .order("event_type", { ascending: true });
      expect(auditRowsError).toBeNull();
      expect(auditRows?.map((row) => row.event_type).sort()).toContain("BUSINESS_CREATED");
      expect(auditRows?.map((row) => row.event_type).sort()).toContain("MEMBERSHIP_CREATED");

      const { error: memberInsertError } = await service.from("business_members").insert({
        business_id: businessAId,
        user_id: member.id,
        role: "member",
        status: "active",
      });
      expect(memberInsertError).toBeNull();

      const { data: visibleBusinessA, error: visibleBusinessAError } = await userA.client
        .from("businesses")
        .select("id, slug, category")
        .eq("id", businessAId)
        .single();
      expect(visibleBusinessAError).toBeNull();
      expect(visibleBusinessA?.id).toBe(businessAId);

      const { data: hiddenBusinessB, error: hiddenBusinessBError } = await userA.client
        .from("businesses")
        .select("id")
        .eq("id", businessBId);
      expect(hiddenBusinessBError).toBeNull();
      expect(hiddenBusinessB ?? []).toHaveLength(0);

      const { data: ownerUpdate, error: ownerUpdateError } = await userA.client
        .from("businesses")
        .update({ description: "Owner update verified." })
        .eq("id", businessAId)
        .select("id, description");
      expect(ownerUpdateError).toBeNull();
      expect(ownerUpdate).toEqual([
        { id: businessAId, description: "Owner update verified." },
      ]);

      const { data: memberUpdate, error: memberUpdateError } = await member.client
        .from("businesses")
        .update({ description: "Member should not update." })
        .eq("id", businessAId)
        .select("id");
      expect(memberUpdateError).toBeNull();
      expect(memberUpdate ?? []).toHaveLength(0);

      const { data: crossTenantUpdate, error: crossTenantUpdateError } =
        await userA.client
          .from("businesses")
          .update({ description: "Cross tenant should not update." })
          .eq("id", businessBId)
          .select("id");
      expect(crossTenantUpdateError).toBeNull();
      expect(crossTenantUpdate ?? []).toHaveLength(0);

      const anon = createSupabaseClient(publishableKey);
      const { error: anonRpcError } = await anon.rpc("create_business_onboarding", {
        business_name: `Anon ${fixtureId}`,
        business_slug: `anon-phase3-${randomUUID().slice(0, 8)}`,
        business_category: "Other",
      });
      expect(anonRpcError).not.toBeNull();

      const invalidSlug = `phase3-invalid-${randomUUID().slice(0, 8)}`;
      const { data: invalidBusinessId, error: invalidBusinessError } =
        await userA.client.rpc("create_business_onboarding", {
          business_name: `Invalid ${fixtureId}`,
          business_slug: invalidSlug,
          business_category: "Marketplace" as never,
        });
      expect(invalidBusinessError).not.toBeNull();
      expect(invalidBusinessId).toBeNull();

      const { data: orphanRows, error: orphanRowsError } = await service
        .from("businesses")
        .select("id")
        .eq("slug", invalidSlug);
      expect(orphanRowsError).toBeNull();
      expect(orphanRows ?? []).toHaveLength(0);
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
  describe.skip("Phase 3 business onboarding runtime security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
