import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { parseAdminOverview, type AdminOverview } from "@/features/admin/overview";
import type { Database } from "@/types/database";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin overview",
  storagePrefix: "platform-admin-overview-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;
type UserFixture = {
  id: string;
  email: string;
  password: string;
  client: AppClient;
};

function tokenHash() {
  return randomBytes(32).toString("hex");
}

if (runtimeVerificationEnabled) {
  describe("platform admin overview runtime authorization and aggregates", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `pao-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `${fixtureId}-${label}@example.com`.toLowerCase();
      const password = `Overview-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Overview test ${label}` },
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

    async function overviewFor(client: AppClient): Promise<AdminOverview> {
      const { data, error } = await client.rpc("get_platform_admin_overview");
      expect(error).toBeNull();
      const overview = parseAdminOverview(data);
      expect(overview).not.toBeNull();
      return overview!;
    }

    it("returns exact global aggregates only to an active admin", async () => {
      const activeAdmin = await createUser("active-admin");
      const { error: platformAdminError } = await service
        .from("platform_admins")
        .insert({
          user_id: activeAdmin.id,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        });
      expect(platformAdminError).toBeNull();

      const baseline = await overviewFor(activeAdmin.client);
      const owner = await createUser("multi-owner");

      const businessRows = ["business-a", "business-b"].map((label) => ({
        name: `${fixtureId} ${label}`,
        slug: `${fixtureId}-${label}`.toLowerCase(),
        category: "Other",
        onboarding_completed_at: new Date().toISOString(),
        created_by: owner.id,
      }));
      const { data: businesses, error: businessesError } = await service
        .from("businesses")
        .insert(businessRows)
        .select("id");
      expect(businessesError).toBeNull();
      expect(businesses).toHaveLength(2);
      createdBusinessIds.push(...businesses!.map((business) => business.id));

      const memberships = businesses!.flatMap((business) => [
        {
          business_id: business.id,
          user_id: owner.id,
          role: "owner" as const,
          status: "active" as const,
        },
        {
          business_id: business.id,
          user_id: activeAdmin.id,
          role: "owner" as const,
          status: "active" as const,
        },
      ]);
      const { error: membershipsError } = await service
        .from("business_members")
        .insert(memberships);
      expect(membershipsError).toBeNull();

      const customerRows = businesses!.map((business, index) => ({
        business_id: business.id,
        name: `${fixtureId} customer ${index + 1}`,
        email: `${fixtureId}-customer-${index + 1}@example.com`.toLowerCase(),
      }));
      const { data: customers, error: customersError } = await service
        .from("customers")
        .insert(customerRows)
        .select("id, business_id");
      expect(customersError).toBeNull();
      expect(customers).toHaveLength(2);

      const now = new Date();
      const utcDayStart = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      const utcDayEnd = utcDayStart + 86_400_000;
      const dueTodayAt = new Date(
        Math.max(
          utcDayStart + 1_000,
          Math.min(now.getTime() + 60_000, utcDayEnd - 1_000),
        ),
      );
      const overdueAt = new Date(now.getTime() - 48 * 60 * 60 * 1_000);
      const deliveredAt = new Date(now.getTime() - 72 * 60 * 60 * 1_000);

      const bookingRows = [
        {
          business_id: businesses![0].id,
          customer_id: customers![0].id,
          title: `${fixtureId} unscheduled`,
          total_amount_minor: 1_000,
          status: "DRAFT" as const,
          created_by: owner.id,
        },
        {
          business_id: businesses![0].id,
          customer_id: customers![0].id,
          title: `${fixtureId} due today`,
          total_amount_minor: 2_000,
          scheduled_for: dueTodayAt.toISOString(),
          status: "DRAFT" as const,
          created_by: owner.id,
        },
        {
          business_id: businesses![0].id,
          customer_id: customers![0].id,
          title: `${fixtureId} overdue`,
          total_amount_minor: 3_000,
          scheduled_for: overdueAt.toISOString(),
          status: "DRAFT" as const,
          created_by: owner.id,
        },
        {
          business_id: businesses![1].id,
          customer_id: customers![1].id,
          title: `${fixtureId} delivered`,
          total_amount_minor: 4_000,
          scheduled_for: deliveredAt.toISOString(),
          status: "DELIVERED" as const,
          created_by: owner.id,
        },
        {
          business_id: businesses![1].id,
          customer_id: customers![1].id,
          title: `${fixtureId} completed`,
          total_amount_minor: 5_000,
          scheduled_for: deliveredAt.toISOString(),
          status: "COMPLETED" as const,
          created_by: owner.id,
        },
      ];
      const { data: bookings, error: bookingsError } = await service
        .from("bookings")
        .insert(bookingRows)
        .select("id, business_id, customer_id");
      expect(bookingsError).toBeNull();
      expect(bookings).toHaveLength(5);

      const hash = tokenHash();
      const { error: amendmentError } = await service
        .from("booking_amendments")
        .insert({
          business_id: bookings![0].business_id,
          booking_id: bookings![0].id,
          token_hash: tokenHash(),
          expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
          reason: "Controlled aggregate fixture",
          base_terms_hash: hash,
          old_terms: { title: "Before" },
          proposed_terms: { title: "After" },
          proposed_terms_hash: tokenHash(),
          changed_fields: ["title"],
          contact_email: `${fixtureId}-amendment@example.com`.toLowerCase(),
          proposed_by: owner.id,
        });
      expect(amendmentError).toBeNull();

      const { error: addonError } = await service.from("booking_addons").insert({
        business_id: bookings![0].business_id,
        booking_id: bookings![0].id,
        created_by: owner.id,
        title: `${fixtureId} add-on`,
        currency: "NGN",
        total_amount_minor: 500,
        status: "DRAFT",
      });
      expect(addonError).toBeNull();

      const { data: issues, error: issuesError } = await owner.client
        .from("booking_issues")
        .insert([
          {
            business_id: bookings![0].business_id,
            booking_id: bookings![0].id,
            category: "OTHER",
            description: "Controlled open issue fixture",
            created_by: owner.id,
          },
          {
            business_id: bookings![1].business_id,
            booking_id: bookings![1].id,
            category: "OTHER",
            description: "Controlled resolved issue fixture",
            created_by: owner.id,
          },
        ])
        .select("id");
      expect(issuesError).toBeNull();
      expect(issues).toHaveLength(2);
      const { error: resolveIssueError } = await owner.client
        .from("booking_issues")
        .update({ status: "RESOLVED" })
        .eq("id", issues![1].id);
      expect(resolveIssueError).toBeNull();

      const emailStatuses = ["PENDING", "SENDING", "SENT", "FAILED"] as const;
      for (const [index, status] of emailStatuses.entries()) {
        const booking = bookings![index];
        const { data: link, error: linkError } = await service
          .from("confirmation_links")
          .insert({
            business_id: booking.business_id,
            booking_id: booking.id,
            token_hash: tokenHash(),
            expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
            created_by: owner.id,
          })
          .select("id")
          .single();
        expect(linkError).toBeNull();

        const { data: confirmation, error: confirmationError } = await service
          .from("booking_confirmations")
          .insert({
            business_id: booking.business_id,
            booking_id: booking.id,
            confirmation_link_id: link!.id,
            terms_hash: tokenHash(),
            terms_snapshot: { fixture: fixtureId },
            contact_email: `${fixtureId}-recipient@example.com`.toLowerCase(),
          })
          .select("id")
          .single();
        expect(confirmationError).toBeNull();

        const attempted = status !== "PENDING";
        const sent = status === "SENT";
        const failed = status === "FAILED";
        const { error: emailError } = await service.from("email_events").insert({
          business_id: booking.business_id,
          booking_id: booking.id,
          customer_id: booking.customer_id,
          booking_confirmation_id: confirmation!.id,
          event_type: "BOOKING_CONFIRMED",
          recipient_email: `${fixtureId}-recipient@example.com`.toLowerCase(),
          status,
          attempt_count: attempted ? 1 : 0,
          last_attempt_at: attempted ? now.toISOString() : null,
          sent_at: sent ? now.toISOString() : null,
          provider_message_id: sent ? `${fixtureId}-provider` : null,
          failure_code: failed ? "CONTROLLED_TEST" : null,
          failure_message: failed ? "Controlled fixture failure" : null,
        });
        expect(emailError).toBeNull();
      }

      const after = await overviewFor(activeAdmin.client);
      const dueBecameOverdue =
        dueTodayAt.getTime() < new Date(after.refreshed_at).getTime() ? 1 : 0;

      expect(after.businesses - baseline.businesses).toBe(2);
      expect(after.platform_users - baseline.platform_users).toBe(1);
      expect(after.customers - baseline.customers).toBe(2);
      expect(after.bookings - baseline.bookings).toBe(5);
      expect(after.active_bookings - baseline.active_bookings).toBe(4);
      expect(after.due_today - baseline.due_today).toBe(1);
      expect(after.overdue - baseline.overdue).toBe(1 + dueBecameOverdue);
      expect(after.completed - baseline.completed).toBe(1);
      expect(after.open_issues - baseline.open_issues).toBe(1);
      expect(after.email_pending - baseline.email_pending).toBe(1);
      expect(after.email_sending - baseline.email_sending).toBe(1);
      expect(after.email_sent - baseline.email_sent).toBe(1);
      expect(after.email_failed - baseline.email_failed).toBe(1);

      const { error: ownerAttackError } = await owner.client.rpc(
        "get_platform_admin_overview",
      );
      expect(ownerAttackError).not.toBeNull();

      const anonymous = runtime.createSupabaseClient(publishableKey);
      const { error: anonymousAttackError } = await anonymous.rpc(
        "get_platform_admin_overview",
      );
      expect(anonymousAttackError).not.toBeNull();

      const { error: disableError } = await service
        .from("platform_admins")
        .update({ status: "DISABLED" })
        .eq("user_id", activeAdmin.id);
      expect(disableError).toBeNull();
      const { error: disabledAttackError } = await activeAdmin.client.rpc(
        "get_platform_admin_overview",
      );
      expect(disabledAttackError).not.toBeNull();
    }, 180_000);

    afterAll(async () => {
      if (createdBusinessIds.length > 0 || createdUserIds.length > 0) {
        let auditDelete = service.from("audit_logs").delete();
        if (createdBusinessIds.length > 0 && createdUserIds.length > 0) {
          auditDelete = auditDelete.or(
            `business_id.in.(${createdBusinessIds.join(",")}),actor_user_id.in.(${createdUserIds.join(",")})`,
          );
        } else if (createdBusinessIds.length > 0) {
          auditDelete = auditDelete.in("business_id", createdBusinessIds);
        } else {
          auditDelete = auditDelete.in("actor_user_id", createdUserIds);
        }
        await auditDelete;
      }

      if (createdBusinessIds.length > 0) {
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
          .gte("created_at", new Date(Date.now() - 300_000).toISOString());
        const ids = (platformAudits ?? [])
          .filter((row) =>
            createdUserIds.includes(
              String((row.metadata as Record<string, unknown>).target_user_id),
            ),
          )
          .map((row) => row.id);
        if (ids.length > 0) {
          await service.from("audit_logs").delete().in("id", ids);
        }
        await service.from("platform_admins").delete().in("user_id", createdUserIds);
        await Promise.allSettled(
          createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
        );
      }
    });
  });
}

if (!runtimeVerificationEnabled) {
  describe.skip("platform admin overview runtime authorization and aggregates", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
