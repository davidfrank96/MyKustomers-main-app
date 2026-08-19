import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { hashRateLimitIdentity } from "@/features/confirmation-links/rate-limit-keys";

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
    throw new Error(`${name} is required for Phase 6 runtime verification.`);
  }

  return value;
}

function createSupabaseClient(key: string) {
  return createClient<Database>(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `phase6-runtime-${randomUUID()}`,
    },
  });
}

function expectNoRows<T>(data: T[] | null) {
  expect(data ?? []).toHaveLength(0);
}

function statusFrom(value: unknown) {
  if (typeof value === "object" && value !== null && "status" in value) {
    return (value as { status: unknown }).status;
  }

  return null;
}

function bookingFrom(value: unknown) {
  if (typeof value === "object" && value !== null && "booking" in value) {
    return (value as { booking: Record<string, unknown> }).booking;
  }

  return null;
}

if (runtimeVerificationEnabled) {
  describe("Phase 6 secure customer confirmation runtime security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase6_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdBookingIds: string[] = [];
    const createdRateBuckets: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase6-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase6-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 6 ${label}`,
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
      const slug = `phase6-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 6 ${label}`,
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
          name: `Phase 6 ${label}`,
          email: `${safeLabel}-${Date.now()}@example.com`,
          phone: "+353 01 555 0101",
          notes: "Runtime confirmation customer",
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
          description: "Runtime confirmation booking",
          currency: "NGN",
          total_amount_minor: 4_500_000,
          deposit_amount_minor: 500_000,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Private internal runtime note",
          created_by: creatorId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBookingIds.push(data!.id);
      return data!.id;
    }

    async function generateLink(client: AppClient, bookingId: string) {
      const token = generateConfirmationToken();
      const { data, error } = await client.rpc("create_booking_confirmation_link", {
        p_booking_id: bookingId,
        p_token_hash: hashConfirmationToken(token),
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });

      expect(error).toBeNull();
      expect(data?.[0]?.confirmation_link_id).toBeTruthy();
      return { token, linkId: data![0].confirmation_link_id };
    }

    async function publicView(token: string) {
      const { data, error } = await service.rpc("get_confirmation_public_view", {
        p_token_hash: hashConfirmationToken(token),
      });
      expect(error).toBeNull();
      return data;
    }

    async function publicConfirm(token: string) {
      const { data, error } = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(token),
      });
      expect(error).toBeNull();
      return data;
    }

    it("validates secure confirmation tokens, public minimization, and lifecycle integrity", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");
      const customerAId = await createCustomer(userA.client, businessAId, "Customer A");
      const customerBId = await createCustomer(userB.client, businessBId, "Customer B");

      const bookingAId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Valid Booking",
      );
      await createBooking(userB.client, businessBId, customerBId, userB.id, "Phase 6 Booking B");

      const { token: tokenA } = await generateLink(userA.client, bookingAId);

      const { data: awaitingA, error: awaitingAError } = await userA.client
        .from("bookings")
        .select("status")
        .eq("id", bookingAId)
        .single();
      expect(awaitingAError).toBeNull();
      expect(awaitingA?.status).toBe("AWAITING_CUSTOMER");

      const validView = await publicView(tokenA);
      expect(statusFrom(validView)).toBe("valid");
      const validBooking = bookingFrom(validView);
      expect(validBooking?.booking_title).toBe("Phase 6 Valid Booking");
      expect(JSON.stringify(validView)).not.toContain("Private internal runtime note");
      expect(JSON.stringify(validView)).not.toContain("token_hash");
      expect(JSON.stringify(validView)).not.toContain("business_members");
      expect(JSON.stringify(validView)).not.toContain("audit_logs");

      const { data: linkBeforeGet, error: linkBeforeGetError } = await service
        .from("confirmation_links")
        .select("used_at")
        .eq("token_hash", hashConfirmationToken(tokenA))
        .single();
      expect(linkBeforeGetError).toBeNull();
      expect(linkBeforeGet?.used_at).toBeNull();

      const invalidView = await service.rpc("get_confirmation_public_view", {
        p_token_hash: hashConfirmationToken(generateConfirmationToken()),
      });
      expect(invalidView.error).toBeNull();
      expect(statusFrom(invalidView.data)).toBe("unavailable");

      const expiredBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Expired Booking",
      );
      const { token: expiredToken, linkId: expiredLinkId } = await generateLink(
        userA.client,
        expiredBookingId,
      );
      const expiredLinkTable = service.from(
        "confirmation_links",
      ) as unknown as {
        update(values: Record<string, unknown>): {
          eq(column: string, value: string): PromiseLike<{ error: unknown }>;
        };
      };
      const { error: expiredUpdateError } = await expiredLinkTable.update({
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        created_at: new Date(Date.now() - 120_000).toISOString(),
      }).eq("id", expiredLinkId);
      expect(expiredUpdateError).toBeNull();
      expect(statusFrom(await publicConfirm(expiredToken))).toBe("expired");

      const revokedBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Revoked Booking",
      );
      const { token: revokedToken } = await generateLink(userA.client, revokedBookingId);
      const { error: revokeError } = await userA.client.rpc("revoke_booking_confirmation_link", {
        p_booking_id: revokedBookingId,
      });
      expect(revokeError).toBeNull();
      expect(statusFrom(await publicConfirm(revokedToken))).toBe("revoked");

      const { error: crossTenantRevokeError } = await userB.client.rpc(
        "revoke_booking_confirmation_link",
        {
          p_booking_id: bookingAId,
        },
      );
      expect(crossTenantRevokeError).not.toBeNull();

      const confirmResult = await publicConfirm(tokenA);
      expect(statusFrom(confirmResult)).toBe("confirmed");

      const secondConfirmResult = await publicConfirm(tokenA);
      expect(statusFrom(secondConfirmResult)).toBe("already_confirmed");

      const { data: confirmationRows, error: confirmationRowsError } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot")
        .eq("booking_id", bookingAId);
      expect(confirmationRowsError).toBeNull();
      expect(confirmationRows).toHaveLength(1);
      const confirmedTermsHash = confirmationRows![0].terms_hash;

      const { data: confirmedBooking, error: confirmedBookingError } = await service
        .from("bookings")
        .select("status, customer_confirmed_at, confirmation_terms_hash")
        .eq("id", bookingAId)
        .single();
      expect(confirmedBookingError).toBeNull();
      expect(confirmedBooking?.status).toBe("CONFIRMED");
      expect(confirmedBooking?.customer_confirmed_at).toBeTruthy();
      expect(confirmedBooking?.confirmation_terms_hash).toBe(confirmedTermsHash);

      const { data: directLinkRead, error: directLinkReadError } = await userA.client
        .from("confirmation_links")
        .select("token_hash")
        .limit(1);
      expect(directLinkReadError).not.toBeNull();
      expectNoRows(directLinkRead);

      const anon = createSupabaseClient(publishableKey);
      const { data: anonRead, error: anonReadError } = await anon
        .from("confirmation_links")
        .select("token_hash")
        .limit(1);
      expect(anonReadError).not.toBeNull();
      expectNoRows(anonRead);

      const usedViewBeforeMaterialChange = await publicView(tokenA);
      expect(statusFrom(usedViewBeforeMaterialChange)).toBe("already_confirmed");
      expect(bookingFrom(usedViewBeforeMaterialChange)?.total_amount_minor).toBe(4_500_000);

      const { error: materialUpdateError } = await userA.client
        .from("bookings")
        .update({ total_amount_minor: 4_600_000 })
        .eq("id", bookingAId);
      expect(materialUpdateError).toBeNull();

      const { data: invalidatedBooking, error: invalidatedBookingError } = await service
        .from("bookings")
        .select("status, customer_confirmed_at, confirmation_terms_hash")
        .eq("id", bookingAId)
        .single();
      expect(invalidatedBookingError).toBeNull();
      expect(invalidatedBooking?.status).toBe("AWAITING_CUSTOMER");
      expect(invalidatedBooking?.customer_confirmed_at).toBeNull();
      expect(invalidatedBooking?.confirmation_terms_hash).toBeNull();

      const usedViewAfterMaterialChange = await publicView(tokenA);
      expect(statusFrom(usedViewAfterMaterialChange)).toBe("already_confirmed");
      expect(bookingFrom(usedViewAfterMaterialChange)?.total_amount_minor).toBe(4_500_000);

      const { token: newToken } = await generateLink(userA.client, bookingAId);
      expect(statusFrom(await publicView(newToken))).toBe("valid");

      const nonMaterialBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Non Material Booking",
      );
      const { token: nonMaterialToken } = await generateLink(userA.client, nonMaterialBookingId);
      expect(statusFrom(await publicConfirm(nonMaterialToken))).toBe("confirmed");
      const { data: beforeNotes } = await service
        .from("bookings")
        .select("status, confirmation_terms_hash")
        .eq("id", nonMaterialBookingId)
        .single();
      const { error: notesError } = await userA.client
        .from("bookings")
        .update({ internal_notes: "Notes do not change confirmed terms." })
        .eq("id", nonMaterialBookingId);
      expect(notesError).toBeNull();
      const { data: afterNotes } = await service
        .from("bookings")
        .select("status, confirmation_terms_hash")
        .eq("id", nonMaterialBookingId)
        .single();
      expect(afterNotes?.status).toBe("CONFIRMED");
      expect(afterNotes?.confirmation_terms_hash).toBe(beforeNotes?.confirmation_terms_hash);

      const cancelBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Cancel Booking",
      );
      const { token: cancelToken } = await generateLink(userA.client, cancelBookingId);
      const { error: cancelError } = await userA.client.rpc("transition_booking_status", {
        p_booking_id: cancelBookingId,
        p_to_status: "CANCELLED",
        p_cancellation_reason: "Runtime cancellation",
      });
      expect(cancelError).toBeNull();
      expect(statusFrom(await publicConfirm(cancelToken))).toBe("booking_unavailable");

      const regenBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Regeneration Booking",
      );
      const { token: regenTokenA } = await generateLink(userA.client, regenBookingId);
      const { token: regenTokenB } = await generateLink(userA.client, regenBookingId);
      expect(statusFrom(await publicConfirm(regenTokenA))).toBe("revoked");
      expect(statusFrom(await publicView(regenTokenB))).toBe("valid");

      const raceBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Race Booking",
      );
      const { token: raceToken } = await generateLink(userA.client, raceBookingId);
      const raceResults = await Promise.all([publicConfirm(raceToken), publicConfirm(raceToken)]);
      expect(raceResults.map(statusFrom).sort()).toEqual(["already_confirmed", "confirmed"]);
      const { data: raceConfirmations } = await service
        .from("booking_confirmations")
        .select("id")
        .eq("booking_id", raceBookingId);
      expect(raceConfirmations).toHaveLength(1);

      const rateBucket = hashRateLimitIdentity(`phase6-rate-${randomUUID()}`);
      createdRateBuckets.push(rateBucket);
      const rateCalls = [
        await service.rpc("consume_confirmation_rate_limit", {
          p_bucket_key: rateBucket,
          p_action: "lookup",
          p_max_requests: 2,
          p_window_seconds: 60,
          p_block_seconds: 60,
        }),
        await service.rpc("consume_confirmation_rate_limit", {
          p_bucket_key: rateBucket,
          p_action: "lookup",
          p_max_requests: 2,
          p_window_seconds: 60,
          p_block_seconds: 60,
        }),
        await service.rpc("consume_confirmation_rate_limit", {
          p_bucket_key: rateBucket,
          p_action: "lookup",
          p_max_requests: 2,
          p_window_seconds: 60,
          p_block_seconds: 60,
        }),
      ];
      expect(rateCalls.map((call) => call.data)).toEqual([true, true, false]);

      const { data: auditRows, error: auditRowsError } = await service
        .from("audit_logs")
        .select("event_type")
        .eq("business_id", businessAId);
      expect(auditRowsError).toBeNull();
      expect(auditRows?.map((row) => row.event_type)).toContain("CONFIRMATION_LINK_CREATED");
      expect(auditRows?.map((row) => row.event_type)).toContain("CONFIRMATION_LINK_REGENERATED");
      expect(auditRows?.map((row) => row.event_type)).toContain("CONFIRMATION_LINK_REVOKED");
      expect(auditRows?.map((row) => row.event_type)).toContain("BOOKING_CONFIRMED_BY_CUSTOMER");
      expect(auditRows?.map((row) => row.event_type)).toContain(
        "BOOKING_CONFIRMATION_INVALIDATED",
      );
      expect(JSON.stringify(auditRows)).not.toContain(tokenA);
    }, 180_000);

    afterAll(async () => {
      if (createdRateBuckets.length > 0) {
        await service.from("confirmation_rate_limits").delete().in("bucket_key", createdRateBuckets);
      }

      if (createdBookingIds.length > 0) {
        await service.from("booking_confirmations").delete().in("booking_id", createdBookingIds);
        await service.from("confirmation_links").delete().in("booking_id", createdBookingIds);
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
  describe.skip("Phase 6 secure customer confirmation runtime security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
