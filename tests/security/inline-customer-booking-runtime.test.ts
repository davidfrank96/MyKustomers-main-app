import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "inline customer booking",
  storagePrefix: "inline-customer-booking-runtime",
});
const runtimeVerificationEnabled = runtime.enabled;

type AppClient = SupabaseClient<Database>;
type UserFixture = { id: string; client: AppClient };

if (runtimeVerificationEnabled) {
  describe("inline customer booking runtime security", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `${Date.now()}-${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    let defaultBusinessId = "";

    async function createUser(label: string): Promise<UserFixture> {
      const email = `inline-booking-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Inline-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
      createdUserIds.push(data.user!.id);

      const client = runtime.createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();
      return { id: data.user!.id, client };
    }

    async function createBusiness(ownerId: string, label: string) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Inline Booking ${label}`,
          slug: `inline-booking-${safeLabel}-${randomUUID().slice(0, 8)}`,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: ownerId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      createdBusinessIds.push(data!.id);

      const { error: membershipError } = await service.from("business_members").insert({
        business_id: data!.id,
        user_id: ownerId,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();
      return data!.id;
    }

    async function createCustomer(
      businessId: string,
      name: string,
      contact: { email?: string | null; phone?: string | null } = {},
    ) {
      const { data, error } = await service
        .from("customers")
        .insert({
          business_id: businessId,
          name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id;
    }

    function bookingArgs(
      overrides: Partial<
        Database["public"]["Functions"]["create_booking_with_customer"]["Args"]
      > = {},
    ) {
      return {
        p_business_id: defaultBusinessId,
        p_customer_mode: "new" as const,
        p_customer_id: null,
        p_new_customer_name: `Sarah ${randomUUID().slice(0, 8)}`,
        p_new_customer_email: null,
        p_new_customer_phone: null,
        p_title: `Birthday Cake ${randomUUID().slice(0, 8)}`,
        p_description: "Runtime inline booking",
        p_currency: "NGN" as const,
        p_total_amount_minor: 4_500_000,
        p_deposit_amount_minor: 500_000,
        p_scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
        p_internal_notes: "Private runtime note",
        ...overrides,
      };
    }

    function legacyBookingArgs(
      overrides: Partial<
        Database["public"]["Functions"]["create_booking_with_customer"]["Args"]
      > = {},
    ) {
      const legacyArgs: Record<string, unknown> = { ...bookingArgs(overrides) };
      delete legacyArgs.p_business_id;
      return legacyArgs;
    }

    it("creates existing and inline customers atomically with tenant-safe behavior", async () => {
      const userA = await createUser("owner-a");
      const userB = await createUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");
      defaultBusinessId = businessAId;
      const existingAId = await createCustomer(businessAId, "Existing Customer A", {
        email: "existing-a@example.com",
      });
      const archivedAId = await createCustomer(businessAId, "Archived Customer A");
      const { data: archivedCustomerCreated } = await service
        .from("customers")
        .select("created_at")
        .eq("id", archivedAId)
        .single();
      const archivedAt = new Date(
        new Date(archivedCustomerCreated!.created_at).getTime() + 1_000,
      ).toISOString();
      const { data: archivedCustomer, error: archiveCustomerError } = await service
        .from("customers")
        .update({ archived_at: archivedAt })
        .eq("id", archivedAId)
        .select("id, archived_at")
        .single();
      expect(archiveCustomerError).toBeNull();
      expect(archivedCustomer?.archived_at).toBeTruthy();
      const customerBId = await createCustomer(businessBId, "Customer B");
      const duplicateAId = await createCustomer(businessAId, "Duplicate Sarah", {
        email: "duplicate@example.com",
        phone: "+353 01 555 0101",
      });
      await createCustomer(businessBId, "Private Duplicate B", {
        email: "duplicate@example.com",
      });

      const { count: customerCountBeforeExisting } = await service
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessAId);
      const { data: existingResult, error: existingError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_customer_mode: "existing",
          p_customer_id: existingAId,
          p_new_customer_name: null,
          p_title: "Existing Customer Runtime Booking",
        }),
      );
      expect(existingError).toBeNull();
      expect(existingResult?.[0]).toMatchObject({
        customer_id: existingAId,
        customer_created: false,
        status: "DRAFT",
      });
      expect(existingResult?.[0].reference).toMatch(/^MC-[0-9]{6}-[A-F0-9]{6}$/);
      const { count: customerCountAfterExisting } = await service
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessAId);
      expect(customerCountAfterExisting).toBe(customerCountBeforeExisting);

      const inlineName = `Sarah Okafor ${randomUUID().slice(0, 8)}`;
      const { data: inlineResult, error: inlineError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_new_customer_name: `  ${inlineName}  `,
          p_new_customer_email: " SARAH.RUNTIME@EXAMPLE.COM ",
          p_new_customer_phone: " +353 01 555 0199 ",
          p_title: "Inline Birthday Cake",
        }),
      );
      expect(inlineError).toBeNull();
      expect(inlineResult?.[0]).toMatchObject({
        customer_created: true,
        status: "DRAFT",
      });
      const inlineCustomerId = inlineResult![0].customer_id;
      const inlineBookingId = inlineResult![0].booking_id;

      const [{ data: inlineCustomer }, { data: inlineBooking }, { data: history }] =
        await Promise.all([
          service
            .from("customers")
            .select("business_id, name, email, phone")
            .eq("id", inlineCustomerId)
            .single(),
          service
            .from("bookings")
            .select("business_id, customer_id, created_by, status")
            .eq("id", inlineBookingId)
            .single(),
          service
            .from("booking_status_history")
            .select("from_status, to_status, changed_by")
            .eq("booking_id", inlineBookingId),
        ]);
      expect(inlineCustomer).toEqual({
        business_id: businessAId,
        name: inlineName,
        email: "sarah.runtime@example.com",
        phone: "+353 01 555 0199",
      });
      expect(inlineBooking).toEqual({
        business_id: businessAId,
        customer_id: inlineCustomerId,
        created_by: userA.id,
        status: "DRAFT",
      });
      expect(history).toEqual([
        { from_status: null, to_status: "DRAFT", changed_by: userA.id },
      ]);

      const nameOnly = `Name Only ${randomUUID().slice(0, 8)}`;
      const { data: nameOnlyResult, error: nameOnlyError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_new_customer_name: nameOnly,
          p_title: "Name Only Booking",
        }),
      );
      expect(nameOnlyError).toBeNull();
      const nameOnlyCustomerId = nameOnlyResult![0].customer_id;
      const nameOnlyBookingId = nameOnlyResult![0].booking_id;
      const { data: nameOnlyCustomer } = await service
        .from("customers")
        .select("email, phone")
        .eq("id", nameOnlyCustomerId)
        .single();
      expect(nameOnlyCustomer).toEqual({ email: null, phone: null });

      const token = generateConfirmationToken();
      const { error: linkError } = await userA.client.rpc(
        "create_booking_confirmation_link",
        {
          p_booking_id: nameOnlyBookingId,
          p_token_hash: hashConfirmationToken(token),
          p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
      expect(linkError).toBeNull();
      const { data: confirmResult, error: confirmError } = await service.rpc(
        "confirm_booking_by_token_hash",
        {
          p_token_hash: hashConfirmationToken(token),
          p_contact_email: "enriched@example.com",
          p_contact_phone: "+353 01 555 0177",
        },
      );
      expect(confirmError).toBeNull();
      expect((confirmResult as { status?: string })?.status).toBe("confirmed");
      const { data: enrichedCustomer } = await service
        .from("customers")
        .select("email, phone")
        .eq("id", nameOnlyCustomerId)
        .single();
      expect(enrichedCustomer).toEqual({
        email: "enriched@example.com",
        phone: "+353 01 555 0177",
      });

      const { error: crossTenantError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_customer_mode: "existing",
          p_customer_id: customerBId,
          p_new_customer_name: null,
          p_title: "Cross Tenant Existing Attack",
        }),
      );
      expect(crossTenantError).not.toBeNull();
      const { data: crossTenantBookings } = await service
        .from("bookings")
        .select("id")
        .eq("title", "Cross Tenant Existing Attack");
      expectNoRows(crossTenantBookings);

      const { error: archivedError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_customer_mode: "existing",
          p_customer_id: archivedAId,
          p_new_customer_name: null,
          p_title: "Archived Customer Attack",
        }),
      );
      expect(archivedError).not.toBeNull();

      const rollbackCustomerName = `Rollback ${randomUUID().slice(0, 8)}`;
      const { count: auditCountBeforeRollback } = await service
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessAId);
      const { error: rollbackError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_new_customer_name: rollbackCustomerName,
          p_title: "x".repeat(161),
        }),
      );
      expect(rollbackError).not.toBeNull();
      const [{ data: rollbackCustomers }, { count: auditCountAfterRollback }] =
        await Promise.all([
          service.from("customers").select("id").eq("name", rollbackCustomerName),
          service
            .from("audit_logs")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessAId),
        ]);
      expectNoRows(rollbackCustomers);
      expect(auditCountAfterRollback).toBe(auditCountBeforeRollback);

      const injectedName = `Injected ${randomUUID().slice(0, 8)}`;
      const { error: injectedBusinessError } = await userA.client.rpc(
        "create_booking_with_customer",
        bookingArgs({
          p_business_id: businessBId,
          p_new_customer_name: injectedName,
        }),
      );
      expect(injectedBusinessError).not.toBeNull();
      const { data: injectedCustomers } = await service
        .from("customers")
        .select("id")
        .eq("name", injectedName);
      expectNoRows(injectedCustomers);

      const legacyRpc = userB.client.rpc.bind(userB.client) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{
        data: { booking_id: string }[] | null;
        error: unknown;
      }>;
      const legacySingleBusinessArgs = legacyBookingArgs({
        p_new_customer_name: `Legacy Single ${randomUUID().slice(0, 8)}`,
        p_title: "Legacy Single Business Booking",
      });
      const { data: legacyResult, error: legacyError } = await legacyRpc(
        "create_booking_with_customer",
        legacySingleBusinessArgs,
      );
      expect(legacyError).toBeNull();
      const { data: legacyBooking } = await service
        .from("bookings")
        .select("business_id")
        .eq("id", legacyResult![0].booking_id)
        .single();
      expect(legacyBooking?.business_id).toBe(businessBId);

      const businessASecondId = await createBusiness(userA.id, "Business A Second");
      const secondBusinessCustomerName = `Second Business ${randomUUID().slice(0, 8)}`;
      const { data: secondBusinessResult, error: secondBusinessError } =
        await userA.client.rpc(
          "create_booking_with_customer",
          bookingArgs({
            p_business_id: businessASecondId,
            p_new_customer_name: secondBusinessCustomerName,
            p_title: "Explicit Second Business Booking",
          }),
        );
      expect(secondBusinessError).toBeNull();
      const { data: secondBusinessBooking } = await service
        .from("bookings")
        .select("business_id")
        .eq("id", secondBusinessResult![0].booking_id)
        .single();
      expect(secondBusinessBooking?.business_id).toBe(businessASecondId);

      const multiBusinessLegacyRpc = userA.client.rpc.bind(
        userA.client,
      ) as unknown as typeof legacyRpc;
      const legacyMultiCustomerName = `Legacy Multi ${randomUUID().slice(0, 8)}`;
      const legacyMultiBusinessArgs = legacyBookingArgs({
        p_new_customer_name: legacyMultiCustomerName,
        p_title: "Legacy Multi Business Attack",
      });
      const { error: legacyMultiError } = await multiBusinessLegacyRpc(
        "create_booking_with_customer",
        legacyMultiBusinessArgs,
      );
      expect(legacyMultiError).not.toBeNull();
      const { data: legacyMultiCustomers } = await service
        .from("customers")
        .select("id")
        .eq("name", legacyMultiCustomerName);
      expectNoRows(legacyMultiCustomers);

      const { data: visibleDuplicateMatches } = await userA.client
        .from("customers")
        .select("id")
        .eq("email", "duplicate@example.com")
        .is("archived_at", null);
      expect(visibleDuplicateMatches).toEqual([{ id: duplicateAId }]);

      const concurrent = await Promise.all([
        userA.client.rpc(
          "create_booking_with_customer",
          bookingArgs({
            p_new_customer_name: `Concurrent A ${randomUUID().slice(0, 8)}`,
          }),
        ),
        userA.client.rpc(
          "create_booking_with_customer",
          bookingArgs({
            p_new_customer_name: `Concurrent B ${randomUUID().slice(0, 8)}`,
          }),
        ),
      ]);
      expect(concurrent.every((result) => result.error === null)).toBe(true);
      expect(new Set(concurrent.map((result) => result.data?.[0].booking_id)).size).toBe(
        2,
      );

      const { data: auditRows } = await service
        .from("audit_logs")
        .select("event_type, metadata")
        .eq("business_id", businessAId);
      expect(auditRows?.map((row) => row.event_type)).toContain("CUSTOMER_CREATED");
      expect(auditRows?.map((row) => row.event_type)).toContain("BOOKING_CREATED");
      expect(JSON.stringify(auditRows)).not.toContain("sarah.runtime@example.com");

      const anon = runtime.createSupabaseClient(publishableKey);
      const { error: anonError } = await anon.rpc(
        "create_booking_with_customer",
        bookingArgs(),
      );
      expect(anonError).not.toBeNull();
    }, 180_000);

    afterAll(async () => {
      if (createdBusinessIds.length > 0) {
        const { data: bookings } = await service
          .from("bookings")
          .select("id")
          .in("business_id", createdBusinessIds);
        const bookingIds = bookings?.map((booking) => booking.id) ?? [];

        if (bookingIds.length > 0) {
          await service.from("email_events").delete().in("booking_id", bookingIds);
          await service
            .from("booking_confirmations")
            .delete()
            .in("booking_id", bookingIds);
          await service.from("confirmation_links").delete().in("booking_id", bookingIds);
          await service
            .from("booking_status_history")
            .delete()
            .in("booking_id", bookingIds);
          await service.from("bookings").delete().in("id", bookingIds);
        }

        await service.from("customers").delete().in("business_id", createdBusinessIds);
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
  describe.skip("inline customer booking runtime security", () => {
    it("is skipped until explicitly pointed at a safe Supabase target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
