import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "confirmed booking integrity",
  storagePrefix: "confirmed-integrity-runtime",
});

type AppClient = SupabaseClient<Database>;
type UserFixture = { id: string; client: AppClient };

function resultStatus(value: unknown) {
  return typeof value === "object" && value !== null && "status" in value
    ? (value as { status: unknown }).status
    : null;
}

if (runtime.enabled) {
  describe("confirmed booking integrity and cancellation runtime", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `${Date.now()}-${randomUUID()}`;
    const userIds: string[] = [];
    const businessIds: string[] = [];
    const customerIds: string[] = [];
    const bookingIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `integrity-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Integrity-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      userIds.push(data.user!.id);

      const client = runtime.createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();
      return { id: data.user!.id, client };
    }

    async function createBusiness(userId: string, label: string) {
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Integrity ${label}`,
          slug: `integrity-${label.toLowerCase()}-${randomUUID().slice(0, 8)}`,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      businessIds.push(data!.id);
      expect(
        (
          await service.from("business_members").insert({
            business_id: data!.id,
            user_id: userId,
            role: "owner",
            status: "active",
          })
        ).error,
      ).toBeNull();
      return data!.id;
    }

    async function createCustomer(
      client: AppClient,
      businessId: string,
      label: string,
      email: string,
    ) {
      const { data, error } = await client
        .from("customers")
        .insert({ business_id: businessId, name: label, email })
        .select("id")
        .single();
      expect(error).toBeNull();
      customerIds.push(data!.id);
      return data!.id;
    }

    async function createBooking(
      user: UserFixture,
      businessId: string,
      customerId: string,
      title: string,
    ) {
      const { data, error } = await user.client
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title,
          description: "Customer-agreed description",
          currency: "EUR",
          total_amount_minor: 50_000,
          deposit_amount_minor: 10_000,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Initial private note",
          created_by: user.id,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      bookingIds.push(data!.id);
      return data!.id;
    }

    async function confirmBooking(
      user: UserFixture,
      bookingId: string,
      contactEmail: string,
    ) {
      const token = generateConfirmationToken();
      const tokenHash = hashConfirmationToken(token);
      expect(
        (
          await user.client.rpc("create_booking_confirmation_link", {
            p_booking_id: bookingId,
            p_token_hash: tokenHash,
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).toBeNull();
      const { data, error } = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: tokenHash,
        p_contact_email: contactEmail,
      });
      expect(error).toBeNull();
      expect(resultStatus(data)).toBe("confirmed");
      return token;
    }

    it("enforces immutable confirmed terms and atomic idempotent cancellation", async () => {
      const ownerA = await createUser("owner-a");
      const ownerB = await createUser("owner-b");
      const businessA = await createBusiness(ownerA.id, "A");
      const businessB = await createBusiness(ownerB.id, "B");
      const customerA = await createCustomer(
        ownerA.client,
        businessA,
        "Customer A",
        "old@example.com",
      );
      const otherCustomerA = await createCustomer(
        ownerA.client,
        businessA,
        "Other Customer A",
        "other@example.com",
      );
      const customerB = await createCustomer(
        ownerB.client,
        businessB,
        "Customer B",
        "customer-b@example.com",
      );

      const lockedBooking = await createBooking(
        ownerA,
        businessA,
        customerA,
        "Locked booking",
      );
      await confirmBooking(ownerA, lockedBooking, "new@example.com");

      for (const mutation of [
        { title: "Crafted title" },
        { description: "Crafted description" },
        { total_amount_minor: 51_000 },
        { deposit_amount_minor: 11_000 },
        { customer_id: otherCustomerA },
        { scheduled_for: new Date(Date.now() + 172_800_000).toISOString() },
      ]) {
        const { error } = await ownerA.client
          .from("bookings")
          .update(mutation)
          .eq("id", lockedBooking);
        expect(error).not.toBeNull();
      }

      expect(
        (
          await ownerA.client
            .from("bookings")
            .update({ internal_notes: "Updated after confirmation" })
            .eq("id", lockedBooking)
        ).error,
      ).toBeNull();

      const explicitReschedule = new Date(Date.now() + 259_200_000).toISOString();
      expect(
        (
          await ownerA.client.rpc("reschedule_booking", {
            p_booking_id: lockedBooking,
            p_scheduled_for: explicitReschedule,
          })
        ).error,
      ).toBeNull();
      const { data: rescheduled } = await service
        .from("bookings")
        .select("status, scheduled_for")
        .eq("id", lockedBooking)
        .single();
      expect(rescheduled?.status).toBe("AWAITING_CUSTOMER");
      expect(new Date(rescheduled!.scheduled_for!).getTime()).toBe(
        new Date(explicitReschedule).getTime(),
      );

      const awaitingBooking = await createBooking(
        ownerA,
        businessA,
        customerA,
        "Awaiting edit",
      );
      const awaitingToken = generateConfirmationToken();
      const awaitingHash = hashConfirmationToken(awaitingToken);
      expect(
        (
          await ownerA.client.rpc("create_booking_confirmation_link", {
            p_booking_id: awaitingBooking,
            p_token_hash: awaitingHash,
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await ownerA.client
            .from("bookings")
            .update({ title: "Awaiting edited title" })
            .eq("id", awaitingBooking)
        ).error,
      ).toBeNull();
      const { data: invalidatedLink } = await service
        .from("confirmation_links")
        .select("revoked_at, revoked_reason")
        .eq("token_hash", awaitingHash)
        .single();
      expect(invalidatedLink?.revoked_at).toBeTruthy();
      expect(invalidatedLink?.revoked_reason).toBe("material_change");

      const cancellationBooking = await createBooking(
        ownerA,
        businessA,
        customerA,
        "Cancellation booking",
      );
      const capabilityToken = await confirmBooking(
        ownerA,
        cancellationBooking,
        "new@example.com",
      );
      const { data: evidenceBefore } = await service
        .from("booking_confirmations")
        .select("id, contact_email, terms_hash, terms_snapshot, confirmed_at")
        .eq("booking_id", cancellationBooking)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .single();

      expect(
        (
          await ownerA.client.rpc("transition_booking_status", {
            p_booking_id: cancellationBooking,
            p_to_status: "CANCELLED",
            p_cancellation_reason: null,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerA.client.rpc("transition_booking_status", {
            p_booking_id: cancellationBooking,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "<b>Cancelled</b>",
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerB.client.rpc("transition_booking_status", {
            p_booking_id: cancellationBooking,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Cross-tenant attempt",
          })
        ).error,
      ).not.toBeNull();

      const anon = runtime.createSupabaseClient(publishableKey);
      expect(capabilityToken).toBeTruthy();
      expect(
        (
          await anon.rpc("transition_booking_status", {
            p_booking_id: cancellationBooking,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Capability attempt",
          })
        ).error,
      ).not.toBeNull();

      const race = await Promise.all([
        ownerA.client.rpc("transition_booking_status", {
          p_booking_id: cancellationBooking,
          p_to_status: "CANCELLED",
          p_cancellation_reason: "Customer requested cancellation",
        }),
        ownerA.client.rpc("transition_booking_status", {
          p_booking_id: cancellationBooking,
          p_to_status: "CANCELLED",
          p_cancellation_reason: "Business unable to fulfil",
        }),
      ]);
      expect(
        race.filter((result) => result.error === null),
        race.map((result) => result.error?.message ?? "success").join(" | "),
      ).toHaveLength(1);
      expect(race.filter((result) => result.error !== null)).toHaveLength(1);

      const [{ data: cancelled }, { data: evidenceAfter }, { data: events }] =
        await Promise.all([
          service
            .from("bookings")
            .select("status, cancellation_reason, cancelled_at, internal_notes")
            .eq("id", cancellationBooking)
            .single(),
          service
            .from("booking_confirmations")
            .select("id, contact_email, terms_hash, terms_snapshot, confirmed_at")
            .eq("booking_id", cancellationBooking)
            .order("confirmed_at", { ascending: false })
            .limit(1)
            .single(),
          service
            .from("email_events")
            .select("id, event_type, recipient_email, status")
            .eq("booking_id", cancellationBooking)
            .eq("event_type", "BOOKING_CANCELLED"),
        ]);
      expect(cancelled?.status).toBe("CANCELLED");
      expect(cancelled?.cancelled_at).toBeTruthy();
      expect(["Customer requested cancellation", "Business unable to fulfil"]).toContain(
        cancelled?.cancellation_reason,
      );
      expect(evidenceAfter).toEqual(evidenceBefore);
      expect(events).toHaveLength(1);
      expect(events?.[0]).toMatchObject({
        event_type: "BOOKING_CANCELLED",
        recipient_email: "new@example.com",
        status: "PENDING",
      });

      const { data: claimedEvents, error: claimError } = await service.rpc(
        "claim_email_event",
        { p_email_event_id: events![0].id },
      );
      expect(claimError).toBeNull();
      expect(claimedEvents).toHaveLength(1);
      expect(
        (
          await service
            .from("email_events")
            .update({
              status: "FAILED",
              failure_code: "runtime_provider_failure",
              failure_message: "Synthetic runtime provider failure.",
            })
            .eq("id", events![0].id)
            .eq("status", "SENDING")
        ).error,
      ).toBeNull();
      const [{ data: bookingAfterFailure }, { data: eventAfterFailure }] =
        await Promise.all([
          service
            .from("bookings")
            .select("status")
            .eq("id", cancellationBooking)
            .single(),
          service
            .from("email_events")
            .select("status, attempt_count, failure_code")
            .eq("id", events![0].id)
            .single(),
        ]);
      expect(bookingAfterFailure?.status).toBe("CANCELLED");
      expect(eventAfterFailure).toMatchObject({
        status: "FAILED",
        attempt_count: 1,
        failure_code: "runtime_provider_failure",
      });

      const [{ count: cancelHistoryCount }, { count: cancelAuditCount }] =
        await Promise.all([
          service
            .from("booking_status_history")
            .select("id", { count: "exact", head: true })
            .eq("booking_id", cancellationBooking)
            .eq("to_status", "CANCELLED"),
          service
            .from("audit_logs")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessA)
            .eq("event_type", "BOOKING_CANCELLED")
            .contains("metadata", { booking_id: cancellationBooking }),
        ]);
      expect(cancelHistoryCount).toBe(1);
      expect(cancelAuditCount).toBe(1);

      const draftCancellation = await createBooking(
        ownerA,
        businessA,
        customerA,
        "Draft cancellation",
      );
      expect(
        (
          await ownerA.client.rpc("transition_booking_status", {
            p_booking_id: draftCancellation,
            p_to_status: "CANCELLED",
            p_cancellation_reason: null,
          })
        ).error,
      ).toBeNull();
      const { count: draftCancellationEvents } = await service
        .from("email_events")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", draftCancellation)
        .eq("event_type", "BOOKING_CANCELLED");
      expect(draftCancellationEvents).toBe(0);

      const otherBusinessBooking = await createBooking(
        ownerB,
        businessB,
        customerB,
        "Other business booking",
      );
      expect(otherBusinessBooking).toBeTruthy();
    }, 30_000);

    afterAll(async () => {
      if (bookingIds.length > 0) {
        await service.from("email_events").delete().in("booking_id", bookingIds);
        await service.from("booking_confirmations").delete().in("booking_id", bookingIds);
        await service.from("confirmation_links").delete().in("booking_id", bookingIds);
        await service
          .from("booking_status_history")
          .delete()
          .in("booking_id", bookingIds);
        await service.from("booking_changes").delete().in("booking_id", bookingIds);
        await service.from("bookings").delete().in("id", bookingIds);
      }
      if (customerIds.length > 0) {
        await service.from("customers").delete().in("id", customerIds);
      }
      if (businessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("business_members").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(userIds.map((id) => service.auth.admin.deleteUser(id)));
    });
  });
} else {
  describe.skip("confirmed booking integrity runtime", () => {
    it("requires explicit safe runtime configuration", () => {});
  });
}
