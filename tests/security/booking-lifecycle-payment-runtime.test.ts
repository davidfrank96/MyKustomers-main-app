import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import type { Database } from "@/types/database";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
  }
}

const runtime = createRuntimeSecurityContext({
  suiteName: "booking lifecycle payment recording",
  storagePrefix: "booking-payment-runtime",
});

type AppClient = SupabaseClient<Database>;
const controlledProductionVerificationEnabled =
  process.env.BOOKING_PAYMENT_RUNTIME_VERIFICATION === "1" &&
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
const runtimeVerificationEnabled =
  runtime.enabled || controlledProductionVerificationEnabled;

if (runtimeVerificationEnabled) {
  describe("booking lifecycle payment runtime security", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const userIds: string[] = [];
    const businessIds: string[] = [];
    const bookingIds: string[] = [];

    async function createOwner(label: string) {
      const email = `booking-payment-${label}-${randomUUID()}@example.com`;
      const password = `Booking-Payment-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      const userId = data.user!.id;
      userIds.push(userId);

      const client = runtime.createSupabaseClient(publishableKey);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeNull();

      const { data: business, error: businessError } = await service
        .from("businesses")
        .insert({
          name: `Booking Payment ${label}`,
          slug: `booking-payment-${label}-${randomUUID().slice(0, 8)}`,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      expect(businessError).toBeNull();
      businessIds.push(business!.id);

      const { error: membershipError } = await service.from("business_members").insert({
        business_id: business!.id,
        user_id: userId,
        role: "owner",
        status: "active",
      });
      expect(membershipError).toBeNull();

      const { data: customer, error: customerError } = await client
        .from("customers")
        .insert({
          business_id: business!.id,
          name: `Payment Customer ${label}`,
          email: `payment-customer-${randomUUID()}@example.com`,
        })
        .select("id")
        .single();
      expect(customerError).toBeNull();

      return { client, userId, businessId: business!.id, customerId: customer!.id };
    }

    async function createBooking(
      fixture: Awaited<ReturnType<typeof createOwner>>,
      title: string,
    ) {
      const { data, error } = await fixture.client
        .from("bookings")
        .insert({
          business_id: fixture.businessId,
          customer_id: fixture.customerId,
          title,
          currency: "NGN",
          total_amount_minor: 10_000,
          deposit_amount_minor: 2_000,
          created_by: fixture.userId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      bookingIds.push(data!.id);
      return data!.id;
    }

    async function confirmBooking(client: AppClient, bookingId: string) {
      const token = generateConfirmationToken();
      const tokenHash = hashConfirmationToken(token);
      const { error: linkError } = await client.rpc("create_booking_confirmation_link", {
        p_booking_id: bookingId,
        p_token_hash: tokenHash,
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(linkError).toBeNull();

      const contactEmail = `confirmed-${randomUUID()}@example.com`;
      const confirmations = await Promise.all([
        service.rpc("confirm_booking_by_token_hash", {
          p_token_hash: tokenHash,
          p_contact_email: contactEmail,
        }),
        service.rpc("confirm_booking_by_token_hash", {
          p_token_hash: tokenHash,
          p_contact_email: contactEmail,
        }),
      ]);
      expect(confirmations.every((result) => result.error === null)).toBe(true);
      expect(
        confirmations
          .map((result) => (result.data as { status?: string } | null)?.status)
          .sort(),
      ).toEqual(["already_confirmed", "confirmed"]);
    }

    afterAll(async () => {
      if (bookingIds.length > 0) {
        await service.from("email_events").delete().in("booking_id", bookingIds);
        await service.from("booking_payments").delete().in("booking_id", bookingIds);
        await service.from("booking_confirmations").delete().in("booking_id", bookingIds);
        await service.from("confirmation_links").delete().in("booking_id", bookingIds);
        await service
          .from("booking_status_history")
          .delete()
          .in("booking_id", bookingIds);
        await service.from("bookings").delete().in("id", bookingIds);
      }
      if (businessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("customers").delete().in("business_id", businessIds);
        await service.from("business_members").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(
        userIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );

      const [remainingBusinesses, remainingBookings, remainingPayments] =
        await Promise.all([
          businessIds.length
            ? service.from("businesses").select("id").in("id", businessIds)
            : Promise.resolve({ data: [] }),
          bookingIds.length
            ? service.from("bookings").select("id").in("id", bookingIds)
            : Promise.resolve({ data: [] }),
          bookingIds.length
            ? service.from("booking_payments").select("id").in("booking_id", bookingIds)
            : Promise.resolve({ data: [] }),
        ]);
      expect(remainingBusinesses.data ?? []).toHaveLength(0);
      expect(remainingBookings.data ?? []).toHaveLength(0);
      expect(remainingPayments.data ?? []).toHaveLength(0);
      for (const userId of userIds) {
        expect((await service.auth.admin.getUserById(userId)).error).not.toBeNull();
      }
    });

    it("atomically starts confirmed work and enforces the append-only payment lifecycle", async () => {
      const owner = await createOwner("owner-a");
      const outsider = await createOwner("owner-b");
      const draftBookingId = await createBooking(owner, "Payment lifecycle draft");
      const bookingId = await createBooking(owner, "Payment lifecycle confirmed");

      const { error: draftPaymentError } = await owner.client.rpc(
        "record_booking_payment",
        {
          p_booking_id: draftBookingId,
          p_amount_minor: 100,
          p_operation_id: randomUUID(),
        },
      );
      expect(draftPaymentError?.message).toContain(
        "booking_not_eligible_for_payment_recording",
      );

      await confirmBooking(owner.client, bookingId);
      const [{ data: booking }, { data: history }] = await Promise.all([
        service
          .from("bookings")
          .select("status, started_at")
          .eq("id", bookingId)
          .single(),
        service
          .from("booking_status_history")
          .select("from_status, to_status")
          .eq("booking_id", bookingId)
          .order("changed_at", { ascending: true }),
      ]);
      expect(booking).toMatchObject({ status: "IN_PROGRESS" });
      expect(booking?.started_at).toBeTruthy();
      expect(history?.slice(-2)).toEqual([
        { from_status: "AWAITING_CUSTOMER", to_status: "CONFIRMED" },
        { from_status: "CONFIRMED", to_status: "IN_PROGRESS" },
      ]);

      const { data: initialSummary, error: initialSummaryError } = await owner.client.rpc(
        "get_booking_payment_summary",
        { p_booking_id: bookingId },
      );
      expect(initialSummaryError).toBeNull();
      expect(initialSummary?.[0]).toMatchObject({
        effective_total_amount_minor: 10_000,
        recorded_paid_amount_minor: 2_000,
        outstanding_amount_minor: 8_000,
      });
      const { data: confirmationEvidenceBeforePayment } = await service
        .from("booking_confirmations")
        .select(
          "id, terms_hash, terms_snapshot, contact_email, contact_phone, confirmed_at",
        )
        .eq("booking_id", bookingId)
        .single();

      const anon = runtime.createSupabaseClient(publishableKey);
      const [outsiderSummary, outsiderPayment, anonSummary, anonPayment] =
        await Promise.all([
          outsider.client.rpc("get_booking_payment_summary", { p_booking_id: bookingId }),
          outsider.client.rpc("record_booking_payment", {
            p_booking_id: bookingId,
            p_amount_minor: 100,
            p_operation_id: randomUUID(),
          }),
          anon.rpc("get_booking_payment_summary", { p_booking_id: bookingId }),
          anon.rpc("record_booking_payment", {
            p_booking_id: bookingId,
            p_amount_minor: 100,
            p_operation_id: randomUUID(),
          }),
        ]);
      expect(outsiderSummary.error).not.toBeNull();
      expect(outsiderPayment.error).not.toBeNull();
      expect(anonSummary.error).not.toBeNull();
      expect(anonPayment.error).not.toBeNull();

      const { error: directInsertError } = await owner.client
        .from("booking_payments")
        .insert({
          business_id: owner.businessId,
          booking_id: bookingId,
          operation_id: randomUUID(),
          amount_minor: 100,
          recorded_by: owner.userId,
        });
      expect(directInsertError).not.toBeNull();

      const operationId = randomUUID();
      const concurrent = await Promise.all([
        owner.client.rpc("record_booking_payment", {
          p_booking_id: bookingId,
          p_amount_minor: 3_000,
          p_operation_id: operationId,
        }),
        owner.client.rpc("record_booking_payment", {
          p_booking_id: bookingId,
          p_amount_minor: 3_000,
          p_operation_id: operationId,
        }),
      ]);
      expect(concurrent.every((result) => result.error === null)).toBe(true);
      expect(new Set(concurrent.map((result) => result.data?.[0]?.payment_id)).size).toBe(
        1,
      );

      const { count: operationCount } = await service
        .from("booking_payments")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId)
        .eq("operation_id", operationId);
      expect(operationCount).toBe(1);

      const paymentId = concurrent[0].data?.[0]?.payment_id;
      const [{ error: directUpdateError }, { error: directDeleteError }] =
        await Promise.all([
          owner.client
            .from("booking_payments")
            .update({ amount_minor: 1 } as never)
            .eq("id", paymentId ?? ""),
          owner.client
            .from("booking_payments")
            .delete()
            .eq("id", paymentId ?? ""),
        ]);
      expect(directUpdateError).not.toBeNull();
      expect(directDeleteError).not.toBeNull();

      const { error: operationConflict } = await owner.client.rpc(
        "record_booking_payment",
        {
          p_booking_id: bookingId,
          p_amount_minor: 2_999,
          p_operation_id: operationId,
        },
      );
      expect(operationConflict?.message).toContain("payment_operation_conflict");

      const { error: overpaymentError } = await owner.client.rpc(
        "record_booking_payment",
        {
          p_booking_id: bookingId,
          p_amount_minor: 5_001,
          p_operation_id: randomUUID(),
        },
      );
      expect(overpaymentError?.message).toContain("payment_exceeds_outstanding_balance");

      expect(
        (
          await owner.client.rpc("transition_booking_status", {
            p_booking_id: bookingId,
            p_to_status: "READY",
            p_cancellation_reason: null,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await owner.client.rpc("deliver_booking_with_feedback", {
            p_booking_id: bookingId,
          })
        ).error,
      ).toBeNull();

      const { error: blockedCompletion } = await owner.client.rpc(
        "transition_booking_status",
        {
          p_booking_id: bookingId,
          p_to_status: "COMPLETED",
          p_cancellation_reason: null,
        },
      );
      expect(blockedCompletion?.message).toContain("outstanding_balance");

      const { data: finalPayment, error: finalPaymentError } = await owner.client.rpc(
        "record_booking_payment",
        {
          p_booking_id: bookingId,
          p_amount_minor: 5_000,
          p_operation_id: randomUUID(),
        },
      );
      expect(finalPaymentError).toBeNull();
      expect(finalPayment?.[0]).toMatchObject({
        recorded_paid_amount_minor: 10_000,
        outstanding_amount_minor: 0,
      });

      const { error: completionError } = await owner.client.rpc(
        "transition_booking_status",
        {
          p_booking_id: bookingId,
          p_to_status: "COMPLETED",
          p_cancellation_reason: null,
        },
      );
      expect(completionError).toBeNull();

      const [
        { data: paymentRows },
        { data: auditRows },
        { data: completed },
        { data: confirmationEvidenceAfterPayment },
      ] = await Promise.all([
        service
          .from("booking_payments")
          .select("amount_minor, recorded_by")
          .eq("booking_id", bookingId)
          .order("recorded_at", { ascending: true }),
        service
          .from("audit_logs")
          .select("actor_user_id, event_type, metadata")
          .eq("business_id", owner.businessId)
          .eq("event_type", "BOOKING_PAYMENT_RECORDED"),
        service.from("bookings").select("status").eq("id", bookingId).single(),
        service
          .from("booking_confirmations")
          .select(
            "id, terms_hash, terms_snapshot, contact_email, contact_phone, confirmed_at",
          )
          .eq("booking_id", bookingId)
          .single(),
      ]);
      expect(paymentRows).toEqual([
        { amount_minor: 3_000, recorded_by: owner.userId },
        { amount_minor: 5_000, recorded_by: owner.userId },
      ]);
      expect(auditRows).toHaveLength(2);
      expect(auditRows?.every((row) => row.actor_user_id === owner.userId)).toBe(true);
      expect(auditRows?.every((row) => !JSON.stringify(row.metadata).includes("@"))).toBe(
        true,
      );
      expect(completed?.status).toBe("COMPLETED");
      expect(confirmationEvidenceAfterPayment).toEqual(confirmationEvidenceBeforePayment);

      const concurrencyBookingId = await createBooking(owner, "Concurrent final payment");
      await confirmBooking(owner.client, concurrencyBookingId);
      const concurrentFinalPayments = await Promise.all([
        owner.client.rpc("record_booking_payment", {
          p_booking_id: concurrencyBookingId,
          p_amount_minor: 8_000,
          p_operation_id: randomUUID(),
        }),
        owner.client.rpc("record_booking_payment", {
          p_booking_id: concurrencyBookingId,
          p_amount_minor: 8_000,
          p_operation_id: randomUUID(),
        }),
      ]);
      expect(
        concurrentFinalPayments.filter((result) => result.error === null),
      ).toHaveLength(1);
      const { data: concurrentSummary } = await owner.client.rpc(
        "get_booking_payment_summary",
        { p_booking_id: concurrencyBookingId },
      );
      expect(concurrentSummary?.[0]).toMatchObject({
        recorded_paid_amount_minor: 10_000,
        outstanding_amount_minor: 0,
      });

      const cancelledBookingId = await createBooking(owner, "Cancelled payment history");
      await confirmBooking(owner.client, cancelledBookingId);
      expect(
        (
          await owner.client.rpc("record_booking_payment", {
            p_booking_id: cancelledBookingId,
            p_amount_minor: 1_000,
            p_operation_id: randomUUID(),
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await owner.client.rpc("transition_booking_status", {
            p_booking_id: cancelledBookingId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Controlled runtime cancellation.",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await owner.client.rpc("record_booking_payment", {
            p_booking_id: cancelledBookingId,
            p_amount_minor: 1_000,
            p_operation_id: randomUUID(),
          })
        ).error?.message,
      ).toContain("booking_not_eligible_for_payment_recording");
      expect(
        (
          await owner.client
            .from("booking_payments")
            .select("amount_minor")
            .eq("booking_id", cancelledBookingId)
        ).data,
      ).toEqual([{ amount_minor: 1_000 }]);
    }, 120_000);
  });
} else {
  describe.skip("booking lifecycle payment runtime security", () => {
    it("requires an explicit safe target or controlled production opt-in", () => {});
  });
}
