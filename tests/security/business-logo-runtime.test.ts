import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Business logo storage",
  storagePrefix: "business-logo-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;
const requiredEnv = runtime.requiredEnv;
const createSupabaseClient = runtime.createSupabaseClient;

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  id: string;
  client: AppClient;
};

if (runtimeVerificationEnabled) {
  describe("business logo storage runtime security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const fixtureId = `logo_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdObjectPaths: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `business-logo-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `BusinessLogo-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
      createdUserIds.push(data.user!.id);

      const client = createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      expect(signInError).toBeNull();

      return { id: data.user!.id, client };
    }

    async function createBusiness(client: AppClient, label: string) {
      const { data, error } = await client.rpc("create_business_onboarding", {
        business_name: `Business Logo ${label}`,
        business_slug: `business-logo-${label}-${randomUUID().slice(0, 8)}`,
        business_category: "Other",
        business_description: null,
        business_phone: null,
        business_email: null,
        business_whatsapp: null,
        business_instagram: null,
        business_address_text: null,
        business_website: `https://${label}.example.com`,
      });
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      createdBusinessIds.push(data!);
      return data!;
    }

    afterAll(async () => {
      if (createdObjectPaths.length > 0) {
        await service.storage.from("business-logos").remove(createdObjectPaths);
      }
      if (createdBusinessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", createdBusinessIds);
        await service.from("business_members").delete().in("business_id", createdBusinessIds);
        await service.from("businesses").delete().in("id", createdBusinessIds);
      }
      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    });

    it("allows only owners to manage exact tenant paths while public reads remain non-enumerable", async () => {
      const ownerA = await createConfirmedUser("owner-a");
      const ownerB = await createConfirmedUser("owner-b");
      const member = await createConfirmedUser("member");
      const anonymous = createSupabaseClient(publishableKey);
      const businessAId = await createBusiness(ownerA.client, "owner-a");
      const businessBId = await createBusiness(ownerB.client, "owner-b");
      const pathA = `${businessAId}/logo.webp`;
      const pathB = `${businessBId}/logo.webp`;
      createdObjectPaths.push(pathA, pathB);

      const { error: membershipError } = await service.from("business_members").insert({
        business_id: businessAId,
        user_id: member.id,
        role: "member",
        status: "active",
      });
      expect(membershipError).toBeNull();

      const webp = Buffer.from(
        "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJQBOgCHwAP7+4AAAAA==",
        "base64",
      );

      const { error: ownerUploadError } = await ownerA.client.storage
        .from("business-logos")
        .upload(pathA, webp, { contentType: "image/webp", upsert: true });
      expect(ownerUploadError).toBeNull();

      const { error: ownerUpdateError } = await ownerA.client
        .from("businesses")
        .update({ logo_path: pathA, website: "https://owner-a.example.com/updated" })
        .eq("id", businessAId);
      expect(ownerUpdateError).toBeNull();

      const { error: replacementError } = await ownerA.client.storage
        .from("business-logos")
        .upload(pathA, webp, { contentType: "image/webp", upsert: true });
      expect(replacementError).toBeNull();

      const { error: ownerBUploadError } = await ownerB.client.storage
        .from("business-logos")
        .upload(pathB, webp, { contentType: "image/webp", upsert: true });
      expect(ownerBUploadError).toBeNull();

      const { error: crossTenantUploadError } = await ownerA.client.storage
        .from("business-logos")
        .upload(pathB, webp, { contentType: "image/webp", upsert: true });
      expect(crossTenantUploadError).not.toBeNull();

      const { error: memberUploadError } = await member.client.storage
        .from("business-logos")
        .upload(pathA, webp, { contentType: "image/webp", upsert: true });
      expect(memberUploadError).not.toBeNull();

      const { error: anonymousUploadError } = await anonymous.storage
        .from("business-logos")
        .upload(`${randomUUID()}/logo.webp`, webp, { contentType: "image/webp" });
      expect(anonymousUploadError).not.toBeNull();

      const { data: memberBusinessUpdate, error: memberBusinessUpdateError } =
        await member.client
          .from("businesses")
          .update({ website: "https://member.example.com", logo_path: pathA })
          .eq("id", businessAId)
          .select("id");
      expect(memberBusinessUpdateError).toBeNull();
      expect(memberBusinessUpdate ?? []).toHaveLength(0);

      const publicResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/public/business-logos/${pathA}`,
      );
      expect(publicResponse.ok).toBe(true);
      expect(publicResponse.headers.get("content-type")).toContain("image/webp");

      const { data: anonymousList, error: anonymousListError } = await anonymous.storage
        .from("business-logos")
        .list(businessBId);
      expect(anonymousListError).toBeNull();
      expect(anonymousList ?? []).toHaveLength(0);

      const { error: crossTenantRemoveError } = await ownerA.client.storage
        .from("business-logos")
        .remove([pathB]);
      expect(crossTenantRemoveError).toBeNull();
      const crossTenantObjectStillExists = await fetch(
        `${supabaseUrl}/storage/v1/object/public/business-logos/${pathB}`,
      );
      expect(crossTenantObjectStillExists.ok).toBe(true);

      const { error: ownerRemoveError } = await ownerA.client.storage
        .from("business-logos")
        .remove([pathA]);
      expect(ownerRemoveError).toBeNull();
      const { error: clearReferenceError } = await ownerA.client
        .from("businesses")
        .update({ logo_path: null })
        .eq("id", businessAId);
      expect(clearReferenceError).toBeNull();
    }, 30_000);
  });
} else {
  describe.skip("business logo storage runtime security", () => {
    it("requires explicit non-production runtime opt-in", () => {});
  });
}
