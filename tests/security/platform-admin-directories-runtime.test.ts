import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseAdminBusinessDetail,
  parseAdminBusinessPage,
  parseAdminUserDetail,
  parseAdminUserPage,
} from "@/features/admin/directory";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin directories",
  storagePrefix: "platform-admin-directories-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  client: AppClient;
  email: string;
  id: string;
};

function tokenHash() {
  return randomBytes(32).toString("hex");
}

if (runtimeVerificationEnabled) {
  describe("platform admin directory runtime authorization and projections", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `pad-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `${fixtureId}-${label}@example.com`.toLowerCase();
      const password = `Directory-${label}-${randomUUID()}-A1`;
      let created: Awaited<ReturnType<typeof service.auth.admin.createUser>> | null =
        null;

      for (const delay of [0, 2_000, 4_000, 8_000, 16_000]) {
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        created = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: `${fixtureId} ${label}` },
        });
        if (!created.error || created.error.status !== 429) break;
      }

      expect(created?.error).toBeNull();
      const id = created!.data.user!.id;
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

      return { client, email, id };
    }

    async function expectDenied(client: AppClient) {
      const calls = [
        client.rpc("get_platform_admin_businesses", {
          p_page: 1,
          p_page_size: 20,
          p_search: fixtureId,
        }),
        client.rpc("get_platform_admin_business", {
          p_business_id: randomUUID(),
        }),
        client.rpc("get_platform_admin_users", {
          p_page: 1,
          p_page_size: 20,
          p_search: fixtureId,
        }),
        client.rpc("get_platform_admin_user", { p_user_id: randomUUID() }),
      ];

      const results = await Promise.all(calls);
      for (const result of results) expect(result.error).not.toBeNull();
    }

    it("returns exact paginated support projections only to an active admin", async () => {
      const activeAdmin = await createUser("active-admin");
      const ownerA = await createUser("owner-a");
      const ownerB = await createUser("owner-b");
      const ordinaryMember = await createUser("ordinary-member");
      const { error: adminError } = await service.from("platform_admins").insert({
        user_id: activeAdmin.id,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      expect(adminError).toBeNull();

      const specialName = `${fixtureId} %_,.'\"() business 01`;
      const createdAt = Date.now() - 86_400_000;
      const businessRows = Array.from({ length: 22 }, (_, index) => ({
        name:
          index === 0
            ? specialName
            : `${fixtureId} business ${String(index + 1).padStart(2, "0")}`,
        slug: `${fixtureId}-business-${String(index + 1).padStart(2, "0")}`.toLowerCase(),
        category: "Other",
        email: index === 0 ? `${fixtureId}-contact@example.com` : null,
        phone: index === 0 ? "+353 1 555 0199" : null,
        website: index === 0 ? `https://${fixtureId}.example.com` : null,
        onboarding_completed_at: new Date(createdAt + index * 60_000).toISOString(),
        created_at: new Date(createdAt + index * 60_000).toISOString(),
        created_by: ownerA.id,
      }));
      const { data: businesses, error: businessesError } = await service
        .from("businesses")
        .insert(businessRows)
        .select("id, slug");
      expect(businessesError).toBeNull();
      expect(businesses).toHaveLength(22);
      createdBusinessIds.push(...businesses!.map((business) => business.id));

      const businessA = businesses!.find((business) => business.slug.endsWith("-01"))!;
      const businessB = businesses!.find((business) => business.slug.endsWith("-02"))!;
      const memberships: Database["public"]["Tables"]["business_members"]["Insert"][] =
        businesses!.map((business) => ({
          business_id: business.id,
          user_id: ownerA.id,
          role: "owner" as const,
          status: "active" as const,
        }));
      memberships.push({
        business_id: businessA.id,
        user_id: ownerB.id,
        role: "owner",
        status: "active",
      });
      memberships.push({
        business_id: businessB.id,
        user_id: ordinaryMember.id,
        role: "member",
        status: "active",
      });
      const { error: membershipsError } = await service
        .from("business_members")
        .insert(memberships);
      expect(membershipsError).toBeNull();

      const { data: customers, error: customersError } = await service
        .from("customers")
        .insert([
          { business_id: businessA.id, name: `${fixtureId} customer 1` },
          { business_id: businessA.id, name: `${fixtureId} customer 2` },
        ])
        .select("id");
      expect(customersError).toBeNull();
      expect(customers).toHaveLength(2);

      const { data: bookings, error: bookingsError } = await service
        .from("bookings")
        .insert([
          {
            business_id: businessA.id,
            customer_id: customers![0].id,
            title: `${fixtureId} active`,
            total_amount_minor: 1_000,
            status: "DRAFT",
            created_by: ownerA.id,
          },
          {
            business_id: businessA.id,
            customer_id: customers![0].id,
            title: `${fixtureId} complete`,
            total_amount_minor: 2_000,
            status: "COMPLETED",
            created_by: ownerA.id,
          },
          {
            business_id: businessA.id,
            customer_id: customers![1].id,
            title: `${fixtureId} cancelled`,
            total_amount_minor: 3_000,
            status: "CANCELLED",
            created_by: ownerA.id,
          },
        ])
        .select("id, customer_id");
      expect(bookingsError).toBeNull();
      expect(bookings).toHaveLength(3);

      const { error: issueError } = await ownerA.client.from("booking_issues").insert({
        business_id: businessA.id,
        booking_id: bookings![0].id,
        category: "OTHER",
        description: "Controlled directory fixture",
        created_by: ownerA.id,
      });
      expect(issueError).toBeNull();

      for (const [index, status] of (["PENDING", "FAILED"] as const).entries()) {
        const booking = bookings![index];
        const { data: link, error: linkError } = await service
          .from("confirmation_links")
          .insert({
            business_id: businessA.id,
            booking_id: booking.id,
            token_hash: tokenHash(),
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            created_by: ownerA.id,
          })
          .select("id")
          .single();
        expect(linkError).toBeNull();
        const { data: confirmation, error: confirmationError } = await service
          .from("booking_confirmations")
          .insert({
            business_id: businessA.id,
            booking_id: booking.id,
            confirmation_link_id: link!.id,
            terms_hash: tokenHash(),
            terms_snapshot: { fixture: fixtureId },
            contact_email: `${fixtureId}-recipient@example.com`,
          })
          .select("id")
          .single();
        expect(confirmationError).toBeNull();
        const failed = status === "FAILED";
        const { error: emailError } = await service.from("email_events").insert({
          business_id: businessA.id,
          booking_id: booking.id,
          customer_id: booking.customer_id,
          booking_confirmation_id: confirmation!.id,
          event_type: "BOOKING_CONFIRMED",
          recipient_email: `${fixtureId}-recipient@example.com`,
          status,
          attempt_count: failed ? 1 : 0,
          last_attempt_at: failed ? new Date().toISOString() : null,
          failure_code: failed ? "CONTROLLED_TEST" : null,
          failure_message: failed ? "Controlled fixture failure" : null,
        });
        expect(emailError).toBeNull();
      }

      const { data: firstPageData, error: firstPageError } = await activeAdmin.client.rpc(
        "get_platform_admin_businesses",
        { p_page: 1, p_page_size: 20, p_search: fixtureId.toUpperCase() },
      );
      expect(firstPageError).toBeNull();
      const firstPage = parseAdminBusinessPage(firstPageData);
      expect(firstPage?.total).toBe(22);
      expect(firstPage?.items).toHaveLength(20);

      const { data: secondPageData, error: secondPageError } =
        await activeAdmin.client.rpc("get_platform_admin_businesses", {
          p_page: 2,
          p_page_size: 20,
          p_search: fixtureId,
        });
      expect(secondPageError).toBeNull();
      const secondPage = parseAdminBusinessPage(secondPageData);
      expect(secondPage?.items).toHaveLength(2);
      expect(
        new Set(
          [...(firstPage?.items ?? []), ...(secondPage?.items ?? [])].map(
            (row) => row.id,
          ),
        ).size,
      ).toBe(22);

      for (const search of [
        specialName,
        "%_,.'\"()",
        businessA.slug,
        `${fixtureId}-contact@`,
        "+353 1",
        `${fixtureId}.example`,
      ]) {
        const { data, error } = await activeAdmin.client.rpc(
          "get_platform_admin_businesses",
          {
            p_page: 1,
            p_page_size: 20,
            p_search: search,
          },
        );
        expect(error).toBeNull();
        expect(parseAdminBusinessPage(data)?.items.map((row) => row.id)).toContain(
          businessA.id,
        );
      }

      const { data: businessData, error: businessError } = await activeAdmin.client.rpc(
        "get_platform_admin_business",
        { p_business_id: businessA.id },
      );
      expect(businessError).toBeNull();
      const business = parseAdminBusinessDetail(businessData);
      expect(business?.memberships.filter((row) => row.role === "owner")).toHaveLength(2);
      expect(business?.metrics).toEqual({
        customers: 2,
        bookings: 3,
        active_bookings: 1,
        completed_bookings: 1,
        open_issues: 1,
        failed_emails: 1,
        pending_emails: 1,
      });

      const { data: userPageOneData, error: userPageOneError } =
        await activeAdmin.client.rpc("get_platform_admin_users", {
          p_page: 1,
          p_page_size: 2,
          p_search: fixtureId,
        });
      expect(userPageOneError).toBeNull();
      const userPageOne = parseAdminUserPage(userPageOneData);
      expect(userPageOne?.total).toBe(4);
      expect(userPageOne?.items).toHaveLength(2);
      expect(userPageOne?.items.every((user) => user.providers.includes("email"))).toBe(
        true,
      );

      const { data: userPageTwoData, error: userPageTwoError } =
        await activeAdmin.client.rpc("get_platform_admin_users", {
          p_page: 2,
          p_page_size: 2,
          p_search: fixtureId,
        });
      expect(userPageTwoError).toBeNull();
      const userPageTwo = parseAdminUserPage(userPageTwoData);
      expect(userPageTwo?.items).toHaveLength(2);
      expect(
        new Set(
          [...(userPageOne?.items ?? []), ...(userPageTwo?.items ?? [])].map(
            (row) => row.id,
          ),
        ).size,
      ).toBe(4);

      const { data: ownerData, error: ownerError } = await activeAdmin.client.rpc(
        "get_platform_admin_user",
        { p_user_id: ownerA.id },
      );
      expect(ownerError).toBeNull();
      const owner = parseAdminUserDetail(ownerData);
      expect(owner?.memberships).toHaveLength(22);
      expect(owner?.platform_admin).toBeNull();
      expect(owner?.providers).toEqual(["email"]);

      const { data: adminData, error: adminDetailError } = await activeAdmin.client.rpc(
        "get_platform_admin_user",
        { p_user_id: activeAdmin.id },
      );
      expect(adminDetailError).toBeNull();
      expect(parseAdminUserDetail(adminData)?.platform_admin).toEqual({
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });

      await expectDenied(ownerA.client);
      await expectDenied(runtime.createSupabaseClient(publishableKey));

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      await expectDenied(activeAdmin.client);
    }, 240_000);

    afterAll(async () => {
      if (createdBusinessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", createdBusinessIds);
        await service.from("businesses").delete().in("id", createdBusinessIds);
      }
      if (createdUserIds.length > 0) {
        const { data: platformAudits } = await service
          .from("audit_logs")
          .select("id, metadata")
          .in("event_type", [
            "PLATFORM_ADMIN_CREATED",
            "PLATFORM_ADMIN_UPDATED",
            "PLATFORM_ADMIN_DISABLED",
          ])
          .gte("created_at", new Date(Date.now() - 600_000).toISOString());
        const auditIds = (platformAudits ?? [])
          .filter((row) =>
            createdUserIds.includes(
              String((row.metadata as Record<string, unknown>).target_user_id),
            ),
          )
          .map((row) => row.id);
        if (auditIds.length > 0)
          await service.from("audit_logs").delete().in("id", auditIds);
        await service.from("platform_admins").delete().in("user_id", createdUserIds);
        await Promise.allSettled(
          createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
        );
      }
    });
  });
}

if (!runtimeVerificationEnabled) {
  describe.skip("platform admin directory runtime authorization and projections", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
