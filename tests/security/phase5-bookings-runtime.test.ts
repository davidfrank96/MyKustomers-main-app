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
type UnsafeHistoryTable = {
  insert(values: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ error: unknown }>;
  };
};
type UserFixture = {
  id: string;
  email: string;
  password: string;
  client: AppClient;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Phase 5 runtime verification.`);
  }

  return value;
}

function createSupabaseClient(key: string) {
  return createClient<Database>(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `phase5-runtime-${randomUUID()}`,
    },
  });
}

function expectNoRows<T>(data: T[] | null) {
  expect(data ?? []).toHaveLength(0);
}

if (runtimeVerificationEnabled) {
  describe("Phase 5 booking runtime tenant security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase5_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdBookingIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase5-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase5-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 5 ${label}`,
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
      const slug = `phase5-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 5 ${label}`,
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

    async function createCustomer(
      client: AppClient,
      businessId: string,
      label: string,
    ) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data, error } = await client
        .from("customers")
        .insert({
          business_id: businessId,
          name: `Phase 5 ${label}`,
          email: `${safeLabel}-${Date.now()}@example.com`,
          phone: "+353 01 555 0101",
          notes: "Runtime booking customer",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdCustomerIds.push(data!.id);
      return data!.id;
    }

    async function createBooking(
      client: AppClient,
      businessId: string,
      customerId: string,
      creatorId: string,
      title: string,
    ) {
      const { data, error } = await client
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title,
          description: "Runtime booking",
          currency: "NGN",
          total_amount_minor: 4_500_000,
          deposit_amount_minor: 500_000,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Private vendor notes",
          created_by: creatorId,
        })
        .select("id, reference, status")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBookingIds.push(data!.id);
      return data!;
    }

    it("enforces tenant-scoped booking access, invariants, transitions, and history", async () => {
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
      const customerBId = await createCustomer(userB.client, businessBId, "Needle Booking B");

      const bookingA = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 5 Booking A",
      );
      const bookingB = await createBooking(
        userB.client,
        businessBId,
        customerBId,
        userB.id,
        "Needle Booking B",
      );

      expect(bookingA.reference).toMatch(/^MC-[0-9]{6}-[A-F0-9]{6}$/);
      expect(bookingA.status).toBe("DRAFT");

      const { data: userAOwn, error: userAOwnError } = await userA.client
        .from("bookings")
        .select("id, reference")
        .eq("id", bookingA.id)
        .single();
      expect(userAOwnError).toBeNull();
      expect(userAOwn?.id).toBe(bookingA.id);

      const { data: userACross, error: userACrossError } = await userA.client
        .from("bookings")
        .select("id")
        .eq("id", bookingB.id);
      expect(userACrossError).toBeNull();
      expectNoRows(userACross);

      const { data: userBCross, error: userBCrossError } = await userB.client
        .from("bookings")
        .select("id")
        .eq("id", bookingA.id);
      expect(userBCrossError).toBeNull();
      expectNoRows(userBCross);

      const { error: unauthorizedBusinessCreateError } = await userA.client
        .from("bookings")
        .insert({
          business_id: businessBId,
          customer_id: customerBId,
          title: "Unauthorized business create",
          currency: "NGN",
          total_amount_minor: 1_000,
          deposit_amount_minor: 0,
          created_by: userA.id,
        });
      expect(unauthorizedBusinessCreateError).not.toBeNull();

      const { error: wrongTenantCustomerError } = await userA.client.from("bookings").insert({
        business_id: businessAId,
        customer_id: customerBId,
        title: "Wrong customer tenant",
        currency: "NGN",
        total_amount_minor: 1_000,
        deposit_amount_minor: 0,
        created_by: userA.id,
      });
      expect(wrongTenantCustomerError).not.toBeNull();

      const { error: forgedCreatorError } = await userA.client.from("bookings").insert({
        business_id: businessAId,
        customer_id: customerAId,
        title: "Forged creator",
        currency: "NGN",
        total_amount_minor: 1_000,
        deposit_amount_minor: 0,
        created_by: userB.id,
      });
      expect(forgedCreatorError).not.toBeNull();

      const { data: userAUpdateB, error: userAUpdateBError } = await userA.client
        .from("bookings")
        .update({ title: "Cross tenant edit" })
        .eq("id", bookingB.id)
        .select("id");
      expect(userAUpdateBError).toBeNull();
      expectNoRows(userAUpdateB);

      const { error: businessReassignmentError } = await userA.client
        .from("bookings")
        .update({ business_id: businessBId })
        .eq("id", bookingA.id);
      expect(businessReassignmentError).not.toBeNull();

      const { error: customerReassignmentError } = await userA.client
        .from("bookings")
        .update({ customer_id: customerBId })
        .eq("id", bookingA.id);
      expect(customerReassignmentError).not.toBeNull();

      const { error: referenceMutationError } = await userA.client
        .from("bookings")
        .update({ reference: "MC-260818-AAAAAA" })
        .eq("id", bookingA.id);
      expect(referenceMutationError).not.toBeNull();

      const { error: negativeTotalError } = await userA.client.from("bookings").insert({
        business_id: businessAId,
        customer_id: customerAId,
        title: "Negative total",
        currency: "NGN",
        total_amount_minor: -1,
        deposit_amount_minor: 0,
        created_by: userA.id,
      });
      expect(negativeTotalError).not.toBeNull();

      const { error: impossibleDepositError } = await userA.client.from("bookings").insert({
        business_id: businessAId,
        customer_id: customerAId,
        title: "Impossible deposit",
        currency: "NGN",
        total_amount_minor: 1_000,
        deposit_amount_minor: 1_001,
        created_by: userA.id,
      });
      expect(impossibleDepositError).not.toBeNull();

      const { data: memberBooking, error: memberBookingError } = await memberA.client
        .from("bookings")
        .insert({
          business_id: businessAId,
          customer_id: customerAId,
          title: "Phase 5 Member Booking",
          currency: "EUR",
          total_amount_minor: 12_000,
          deposit_amount_minor: 2_000,
          created_by: memberA.id,
        })
        .select("id")
        .single();
      expect(memberBookingError).toBeNull();
      expect(memberBooking?.id).toBeTruthy();
      createdBookingIds.push(memberBooking!.id);

      const { data: memberUpdate, error: memberUpdateError } = await memberA.client
        .from("bookings")
        .update({ title: "Phase 5 Member Booking Updated" })
        .eq("id", memberBooking!.id)
        .select("id, title");
      expect(memberUpdateError).toBeNull();
      expect(memberUpdate).toEqual([
        { id: memberBooking!.id, title: "Phase 5 Member Booking Updated" },
      ]);

      const { data: confirmed, error: confirmError } = await userA.client
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", bookingA.id)
        .select("id, status")
        .single();
      expect(confirmError).toBeNull();
      expect(confirmed?.status).toBe("CONFIRMED");

      const { error: invalidTransitionError } = await userA.client
        .from("bookings")
        .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
        .eq("id", bookingA.id);
      expect(invalidTransitionError).not.toBeNull();

      const { data: cancelled, error: cancelError } = await userA.client
        .from("bookings")
        .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
        .eq("id", bookingA.id)
        .select("id, status, cancelled_at")
        .single();
      expect(cancelError).toBeNull();
      expect(cancelled?.status).toBe("CANCELLED");
      expect(cancelled?.cancelled_at).toBeTruthy();

      const { error: terminalUpdateError } = await userA.client
        .from("bookings")
        .update({ title: "Should not update terminal booking" })
        .eq("id", bookingA.id);
      expect(terminalUpdateError).not.toBeNull();

      const { data: history, error: historyError } = await userA.client
        .from("booking_status_history")
        .select("from_status, to_status")
        .eq("booking_id", bookingA.id)
        .order("changed_at", { ascending: true });
      expect(historyError).toBeNull();
      expect(history).toEqual([
        { from_status: null, to_status: "DRAFT" },
        { from_status: "DRAFT", to_status: "CONFIRMED" },
        { from_status: "CONFIRMED", to_status: "CANCELLED" },
      ]);

      const unsafeHistory = userA.client.from(
        "booking_status_history",
      ) as unknown as UnsafeHistoryTable;
      const { error: fabricatedHistoryError } = await unsafeHistory.insert({
        booking_id: bookingA.id,
        business_id: businessAId,
        from_status: "CANCELLED",
        to_status: "COMPLETED",
        changed_by: userA.id,
      });
      expect(fabricatedHistoryError).not.toBeNull();

      const { error: mutatedHistoryError } = await unsafeHistory
        .update({ to_status: "COMPLETED" })
        .eq("booking_id", bookingA.id);
      expect(mutatedHistoryError).not.toBeNull();

      const { data: userBHistory, error: userBHistoryError } = await userB.client
        .from("booking_status_history")
        .select("id")
        .eq("booking_id", bookingA.id);
      expect(userBHistoryError).toBeNull();
      expectNoRows(userBHistory);

      const { data: searchLeak, error: searchLeakError } = await userA.client
        .from("bookings")
        .select("id, title")
        .or("title.ilike.%Needle Booking B%,reference.ilike.%Needle Booking B%");
      expect(searchLeakError).toBeNull();
      expect(searchLeak?.some((row) => row.id === bookingB.id)).toBe(false);

      const anon = createSupabaseClient(publishableKey);
      const { data: anonSelect, error: anonSelectError } = await anon
        .from("bookings")
        .select("id")
        .limit(1);
      if (anonSelectError === null) {
        expectNoRows(anonSelect);
      }

      const { error: anonInsertError } = await anon.from("bookings").insert({
        business_id: businessAId,
        customer_id: customerAId,
        title: "Anon booking",
        currency: "NGN",
        total_amount_minor: 1_000,
        deposit_amount_minor: 0,
        created_by: userA.id,
      });
      expect(anonInsertError).not.toBeNull();

      const { data: anonUpdate, error: anonUpdateError } = await anon
        .from("bookings")
        .update({ title: "Anon update" })
        .eq("id", bookingB.id)
        .select("id");
      if (anonUpdateError === null) {
        expectNoRows(anonUpdate);
      }

      const { data: anonHistory, error: anonHistoryError } = await anon
        .from("booking_status_history")
        .select("id")
        .eq("booking_id", bookingA.id);
      if (anonHistoryError === null) {
        expectNoRows(anonHistory);
      }
    }, 120_000);

    afterAll(async () => {
      if (createdBookingIds.length > 0) {
        await service.from("booking_status_history").delete().in("booking_id", createdBookingIds);
        await service.from("bookings").delete().in("id", createdBookingIds);
      }

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
  describe.skip("Phase 5 booking runtime tenant security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
