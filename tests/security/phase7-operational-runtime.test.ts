import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Phase 7",
  storagePrefix: "phase7-runtime",
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
type UnsafeHistoryTable = {
  insert(values: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ error: unknown }>;
  };
  delete(): {
    eq(column: string, value: string): PromiseLike<{ error: unknown }>;
  };
};

function statusFrom(value: unknown) {
  if (typeof value === "object" && value !== null && "status" in value) {
    return (value as { status: unknown }).status;
  }

  return null;
}

if (runtimeVerificationEnabled) {
  describe("Phase 7 operational booking lifecycle runtime security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase7_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdBookingIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase7-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase7-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 7 ${label}`,
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
      const slug = `phase7-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 7 ${label}`,
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
          name: `Phase 7 ${label}`,
          email: `${safeLabel}-${Date.now()}@example.com`,
          phone: "+353 01 555 0177",
          notes: "Runtime operational customer",
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
      scheduledFor = new Date(Date.now() + 86_400_000).toISOString(),
    ) {
      const { data, error } = await client
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title,
          description: "Runtime operational booking",
          currency: "NGN",
          total_amount_minor: 4_500_000,
          deposit_amount_minor: 500_000,
          scheduled_for: scheduledFor,
          internal_notes: "Private operational note",
          created_by: creatorId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBookingIds.push(data!.id);
      return data!.id;
    }

    async function confirmBooking(client: AppClient, bookingId: string) {
      const token = generateConfirmationToken();
      const { error: linkError } = await client.rpc("create_booking_confirmation_link", {
        p_booking_id: bookingId,
        p_token_hash: hashConfirmationToken(token),
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(linkError).toBeNull();

      const { data, error } = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(token),
        p_contact_email: "phase7-confirmation@example.com",
      });
      expect(error).toBeNull();
      expect(statusFrom(data)).toBe("confirmed");

      return token;
    }

    async function createConfirmedBooking(
      user: UserFixture,
      businessId: string,
      customerId: string,
      title: string,
      scheduledFor?: string,
    ) {
      const bookingId = await createBooking(
        user.client,
        businessId,
        customerId,
        user.id,
        title,
        scheduledFor,
      );
      const token = await confirmBooking(user.client, bookingId);
      return { bookingId, token };
    }

    it("enforces operational transitions, history, rescheduling, and terminal locks", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");
      const customerAId = await createCustomer(userA.client, businessAId, "Customer A");
      const customerBId = await createCustomer(userB.client, businessBId, "Customer B");

      const { bookingId: lifecycleBookingId } = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Lifecycle Booking",
      );

      const { error: directStatusError } = await userA.client
        .from("bookings")
        .update({ status: "IN_PROGRESS" })
        .eq("id", lifecycleBookingId);
      expect(directStatusError).not.toBeNull();

      for (const status of ["IN_PROGRESS", "READY", "DELIVERED", "COMPLETED"] as const) {
        const { error } = await userA.client.rpc("transition_booking_status", {
          p_booking_id: lifecycleBookingId,
          p_to_status: status,
          p_cancellation_reason: null,
        });
        expect(error).toBeNull();
      }

      const { data: completedBooking, error: completedBookingError } = await service
        .from("bookings")
        .select("status, started_at, ready_at, delivered_at, completed_at")
        .eq("id", lifecycleBookingId)
        .single();
      expect(completedBookingError).toBeNull();
      expect(completedBooking?.status).toBe("COMPLETED");
      expect(completedBooking?.started_at).toBeTruthy();
      expect(completedBooking?.ready_at).toBeTruthy();
      expect(completedBooking?.delivered_at).toBeTruthy();
      expect(completedBooking?.completed_at).toBeTruthy();

      const { data: lifecycleHistory, error: lifecycleHistoryError } = await service
        .from("booking_status_history")
        .select("from_status, to_status, changed_by")
        .eq("booking_id", lifecycleBookingId)
        .order("changed_at", { ascending: true });
      expect(lifecycleHistoryError).toBeNull();
      expect(lifecycleHistory?.map((row) => row.to_status)).toEqual([
        "DRAFT",
        "AWAITING_CUSTOMER",
        "CONFIRMED",
        "IN_PROGRESS",
        "READY",
        "DELIVERED",
        "COMPLETED",
      ]);
      expect(lifecycleHistory?.filter((row) => row.to_status === "IN_PROGRESS")[0]?.changed_by).toBe(
        userA.id,
      );

      const { data: staleResult, error: staleError } = await userA.client.rpc(
        "transition_booking_status",
        {
          p_booking_id: lifecycleBookingId,
          p_to_status: "IN_PROGRESS",
          p_cancellation_reason: null,
        },
      );
      expect(staleError).not.toBeNull();
      expectNoRows(staleResult);

      const invalidConfirmed = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Invalid Confirmed",
      );
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: invalidConfirmed.bookingId,
            p_to_status: "DELIVERED",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const draftBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 7 Draft Invalid",
      );
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: draftBookingId,
            p_to_status: "READY",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const readyInvalid = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Ready Invalid",
      );
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: readyInvalid.bookingId,
            p_to_status: "IN_PROGRESS",
            p_cancellation_reason: null,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: readyInvalid.bookingId,
            p_to_status: "READY",
            p_cancellation_reason: null,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: readyInvalid.bookingId,
            p_to_status: "COMPLETED",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const cancelledInvalid = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Cancelled Invalid",
      );
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: cancelledInvalid.bookingId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Customer cancelled",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: cancelledInvalid.bookingId,
            p_to_status: "CONFIRMED",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const bookingBId = await createBooking(
        userB.client,
        businessBId,
        customerBId,
        userB.id,
        "Phase 7 Booking B",
      );
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: bookingBId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Cross tenant attempt",
          })
        ).error,
      ).not.toBeNull();

      const anon = createSupabaseClient(publishableKey);
      expect(
        (
          await anon.rpc("transition_booking_status", {
            p_booking_id: invalidConfirmed.bookingId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Anon attempt",
          })
        ).error,
      ).not.toBeNull();

      const tokenOnlyBooking = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 7 Token Boundary",
      );
      await confirmBooking(userA.client, tokenOnlyBooking);
      expect(
        (
          await anon.rpc("transition_booking_status", {
            p_booking_id: tokenOnlyBooking,
            p_to_status: "IN_PROGRESS",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const unsafeHistory = userA.client.from(
        "booking_status_history",
      ) as unknown as UnsafeHistoryTable;
      expect(
        (
          await unsafeHistory.insert({
            booking_id: invalidConfirmed.bookingId,
            business_id: businessAId,
            from_status: "CONFIRMED",
            to_status: "COMPLETED",
            changed_by: userA.id,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (await unsafeHistory.update({ to_status: "COMPLETED" }).eq("booking_id", invalidConfirmed.bookingId))
          .error,
      ).not.toBeNull();
      expect(
        (await unsafeHistory.delete().eq("booking_id", invalidConfirmed.bookingId)).error,
      ).not.toBeNull();

      const rescheduleBooking = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Reschedule Confirmed",
      );
      const newSchedule = new Date(Date.now() + 172_800_000).toISOString();
      const { error: directRescheduleError } = await userA.client
        .from("bookings")
        .update({ scheduled_for: newSchedule })
        .eq("id", rescheduleBooking.bookingId);
      expect(directRescheduleError).not.toBeNull();
      const { error: rescheduleError } = await userA.client.rpc("reschedule_booking", {
        p_booking_id: rescheduleBooking.bookingId,
        p_scheduled_for: newSchedule,
      });
      expect(rescheduleError).toBeNull();

      const { data: rescheduledRow, error: rescheduledRowError } = await service
        .from("bookings")
        .select("status, scheduled_for, customer_confirmed_at, confirmation_terms_hash")
        .eq("id", rescheduleBooking.bookingId)
        .single();
      expect(rescheduledRowError).toBeNull();
      expect(rescheduledRow?.status).toBe("AWAITING_CUSTOMER");
      expect(new Date(rescheduledRow!.scheduled_for!).getTime()).toBe(
        new Date(newSchedule).getTime(),
      );
      expect(rescheduledRow?.customer_confirmed_at).toBeNull();
      expect(rescheduledRow?.confirmation_terms_hash).toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: rescheduleBooking.bookingId,
            p_to_status: "IN_PROGRESS",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();

      const { data: changes, error: changesError } = await userA.client
        .from("booking_changes")
        .select("change_type, previous_scheduled_for, new_scheduled_for")
        .eq("booking_id", rescheduleBooking.bookingId);
      expect(changesError).toBeNull();
      expect(changes).toHaveLength(1);
      expect(changes?.[0]?.change_type).toBe("reschedule");

      const draftRescheduleId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 7 Draft Reschedule",
      );
      const draftSchedule = new Date(Date.now() + 259_200_000).toISOString();
      expect(
        (
          await userA.client.rpc("reschedule_booking", {
            p_booking_id: draftRescheduleId,
            p_scheduled_for: draftSchedule,
          })
        ).error,
      ).toBeNull();
      const { data: draftAfterReschedule } = await service
        .from("bookings")
        .select("status, customer_confirmed_at")
        .eq("id", draftRescheduleId)
        .single();
      expect(draftAfterReschedule?.status).toBe("DRAFT");
      expect(draftAfterReschedule?.customer_confirmed_at).toBeNull();

      const notesBooking = await createConfirmedBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 7 Notes Booking",
      );
      const { data: beforeNotes } = await service
        .from("bookings")
        .select("confirmation_terms_hash")
        .eq("id", notesBooking.bookingId)
        .single();
      expect(
        (
          await userA.client
            .from("bookings")
            .update({ internal_notes: "Operational notes do not change confirmation." })
            .eq("id", notesBooking.bookingId)
        ).error,
      ).toBeNull();
      const { data: afterNotes } = await service
        .from("bookings")
        .select("status, confirmation_terms_hash")
        .eq("id", notesBooking.bookingId)
        .single();
      expect(afterNotes?.status).toBe("CONFIRMED");
      expect(afterNotes?.confirmation_terms_hash).toBe(beforeNotes?.confirmation_terms_hash);

      const cancelLinkBooking = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 7 Cancel Link",
      );
      const cancelToken = generateConfirmationToken();
      expect(
        (
          await userA.client.rpc("create_booking_confirmation_link", {
            p_booking_id: cancelLinkBooking,
            p_token_hash: hashConfirmationToken(cancelToken),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: cancelLinkBooking,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "No longer needed",
          })
        ).error,
      ).toBeNull();
      const { data: cancelledLinkResult } = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(cancelToken),
        p_contact_email: "phase7-cancelled@example.com",
      });
      expect(statusFrom(cancelledLinkResult)).toBe("booking_unavailable");

      expect(
        (
          await userA.client
            .from("bookings")
            .update({ title: "Should not edit completed" })
            .eq("id", lifecycleBookingId)
        ).error,
      ).not.toBeNull();
      expect(
        (
          await userA.client.rpc("reschedule_booking", {
            p_booking_id: lifecycleBookingId,
            p_scheduled_for: new Date(Date.now() + 345_600_000).toISOString(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await userA.client.rpc("transition_booking_status", {
            p_booking_id: lifecycleBookingId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Too late",
          })
        ).error,
      ).not.toBeNull();

      const { data: operationalAudit, error: operationalAuditError } = await service
        .from("audit_logs")
        .select("event_type")
        .eq("business_id", businessAId);
      expect(operationalAuditError).toBeNull();
      const eventTypes = operationalAudit?.map((row) => row.event_type) ?? [];
      expect(eventTypes).toContain("BOOKING_STATUS_CHANGED");
      expect(eventTypes).toContain("BOOKING_CANCELLED");
      expect(eventTypes).toContain("BOOKING_COMPLETED");
      expect(eventTypes).toContain("BOOKING_RESCHEDULED");
      expect(eventTypes).toContain("BOOKING_CONFIRMATION_INVALIDATED");
    }, 240_000);

    afterAll(async () => {
      if (createdBookingIds.length > 0) {
        await service.from("booking_confirmations").delete().in("booking_id", createdBookingIds);
        await service.from("confirmation_links").delete().in("booking_id", createdBookingIds);
        await service.from("booking_status_history").delete().in("booking_id", createdBookingIds);
        await service.from("booking_changes").delete().in("booking_id", createdBookingIds);
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
  describe.skip("Phase 7 operational booking lifecycle runtime security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
