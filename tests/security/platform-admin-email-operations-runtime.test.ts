import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseAdminEmailEventDetail,
  parseAdminEmailOperationsPage,
} from "@/features/admin/email-operations";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "platform admin email operations",
  storagePrefix: "platform-admin-email-operations-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;

if (runtimeVerificationEnabled) {
  describe("platform admin email operations runtime authorization", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixture = `pae-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const createdUserIds: string[] = [];

    async function createUser(label: string) {
      const email = `${fixture}-${label}@example.com`.toLowerCase();
      const password = `Email-Operations-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Email operations ${label}` },
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
        client.rpc("get_platform_admin_email_operations", {
          p_range: "7d",
          p_page: 1,
          p_page_size: 20,
        }),
        client.rpc("get_platform_admin_email_event", {
          p_email_event_id: randomUUID(),
        }),
      ]);
      for (const result of results) expect(result.error).not.toBeNull();
    }

    async function outboxSnapshot() {
      const { data, error } = await service
        .from("email_events")
        .select("id,status,attempt_count,last_attempt_at,sent_at")
        .order("id");
      expect(error).toBeNull();
      return data;
    }

    it("allows minimized immutable reads only for an active admin", async () => {
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
      const before = await outboxSnapshot();

      const { data, error } = await activeAdmin.client.rpc(
        "get_platform_admin_email_operations",
        {
          p_search: "%_,.'\"()",
          p_status: "all",
          p_event_type: "all",
          p_range: "30d",
          p_page: 1,
          p_page_size: 20,
        },
      );
      expect(error).toBeNull();
      const page = parseAdminEmailOperationsPage(data);
      expect(page).not.toBeNull();
      expect(JSON.stringify(data)).not.toMatch(
        /recipient_email|failure_message|failure_code|provider_message_id|customer_id|html|text_body|token_hash/i,
      );

      const { data: unfilteredData, error: unfilteredError } =
        await activeAdmin.client.rpc("get_platform_admin_email_operations", {
          p_range: "30d",
          p_page: 1,
          p_page_size: 20,
        });
      expect(unfilteredError).toBeNull();
      const unfiltered = parseAdminEmailOperationsPage(unfilteredData);
      expect(unfiltered).not.toBeNull();

      if (unfiltered!.items[0]) {
        const { data: detailData, error: detailError } = await activeAdmin.client.rpc(
          "get_platform_admin_email_event",
          { p_email_event_id: unfiltered!.items[0].id },
        );
        expect(detailError).toBeNull();
        expect(parseAdminEmailEventDetail(detailData)).not.toBeNull();
        expect(JSON.stringify(detailData)).not.toMatch(
          /failure_message|failure_code|provider_message_id|customer_id|html|text_body|token_hash/i,
        );
      }

      expect(await outboxSnapshot()).toEqual(before);

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
      if (auditIds.length > 0)
        await service.from("audit_logs").delete().in("id", auditIds);
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
  describe.skip("platform admin email operations runtime authorization", () => {
    it("requires an explicitly safe non-production backend target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
