import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { hashRateLimitIdentity } from "@/features/confirmation-links/rate-limit-keys";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Phase 6",
  storagePrefix: "phase6-runtime",
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

    async function createCustomer(
      client: AppClient,
      businessId: string,
      label: string,
      contact: { email?: string | null; phone?: string | null } = {},
    ) {
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data, error } = await client
        .from("customers")
        .insert({
          business_id: businessId,
          name: `Phase 6 ${label}`,
          email:
            contact.email === undefined
              ? `${safeLabel}-${Date.now()}@example.com`
              : contact.email,
          phone: contact.phone === undefined ? "+353 01 555 0101" : contact.phone,
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

    async function publicConfirm(
      token: string,
      contactEmail = "phase6-confirmation@example.com",
      contactPhone: string | null = null,
    ) {
      const { data, error } = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(token),
        p_contact_email: contactEmail,
        p_contact_phone: contactPhone,
      });
      expect(error).toBeNull();
      return data;
    }

    it("validates secure confirmation tokens, public minimization, and lifecycle integrity", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");
      const customerAId = await createCustomer(
        userA.client,
        businessAId,
        "Customer A",
        { email: "existing@example.com", phone: "+353 01 555 0101" },
      );
      const customerBId = await createCustomer(userB.client, businessBId, "Customer B");

      const bookingAId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Valid Booking",
      );
      const bookingBId = await createBooking(
        userB.client,
        businessBId,
        customerBId,
        userB.id,
        "Phase 6 Booking B",
      );

      const { token: tokenA, linkId: linkAId } = await generateLink(
        userA.client,
        bookingAId,
      );

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

      const { data: firstOpenRecorded, error: firstOpenError } = await service.rpc(
        "record_confirmation_link_open",
        { p_token_hash: hashConfirmationToken(tokenA) },
      );
      expect(firstOpenError).toBeNull();
      expect(firstOpenRecorded).toBe(true);
      const { data: duplicateOpenRecorded, error: duplicateOpenError } =
        await service.rpc("record_confirmation_link_open", {
          p_token_hash: hashConfirmationToken(tokenA),
        });
      expect(duplicateOpenError).toBeNull();
      expect(duplicateOpenRecorded).toBe(false);

      const [{ data: openedLink }, { data: openedEvents }] = await Promise.all([
        service
          .from("confirmation_links")
          .select("first_opened_at")
          .eq("id", linkAId)
          .single(),
        service
          .from("audit_logs")
          .select("event_type, metadata")
          .eq("business_id", businessAId)
          .eq("event_type", "CONFIRMATION_OPENED")
          .contains("metadata", { confirmation_link_id: linkAId }),
      ]);
      expect(openedLink?.first_opened_at).toBeTruthy();
      expect(openedEvents).toHaveLength(1);

      const unauthorizedOpen = await userA.client.rpc(
        "record_confirmation_link_open",
        { p_token_hash: hashConfirmationToken(tokenA) },
      );
      expect(unauthorizedOpen.error).not.toBeNull();

      const delayedOpenBookingId = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 6 Delayed Open Booking",
      );
      const { token: delayedOpenToken, linkId: delayedOpenLinkId } =
        await generateLink(userA.client, delayedOpenBookingId);
      expect(statusFrom(await publicConfirm(delayedOpenToken))).toBe("confirmed");
      const delayedOpen = await service.rpc("record_confirmation_link_open", {
        p_token_hash: hashConfirmationToken(delayedOpenToken),
      });
      expect(delayedOpen.error).toBeNull();
      expect(delayedOpen.data).toBe(true);
      const duplicateDelayedOpen = await service.rpc(
        "record_confirmation_link_open",
        { p_token_hash: hashConfirmationToken(delayedOpenToken) },
      );
      expect(duplicateDelayedOpen.error).toBeNull();
      expect(duplicateDelayedOpen.data).toBe(false);
      const { data: delayedOpenedLink } = await service
        .from("confirmation_links")
        .select("first_opened_at")
        .eq("id", delayedOpenLinkId)
        .single();
      expect(delayedOpenedLink?.first_opened_at).toBeTruthy();

      const { data: linkBeforeGet, error: linkBeforeGetError } = await service
        .from("confirmation_links")
        .select("used_at")
        .eq("token_hash", hashConfirmationToken(tokenA))
        .single();
      expect(linkBeforeGetError).toBeNull();
      expect(linkBeforeGet?.used_at).toBeNull();

      expect(statusFrom(await publicConfirm(tokenA, "not-an-email"))).toBe(
        "invalid_contact",
      );
      const { data: linkAfterInvalid } = await service
        .from("confirmation_links")
        .select("used_at")
        .eq("token_hash", hashConfirmationToken(tokenA))
        .single();
      expect(linkAfterInvalid?.used_at).toBeNull();
      const { data: bookingAfterInvalid } = await service
        .from("bookings")
        .select("status")
        .eq("id", bookingAId)
        .single();
      expect(bookingAfterInvalid?.status).toBe("AWAITING_CUSTOMER");

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

      const confirmResult = await publicConfirm(
        tokenA,
        "new@example.com",
        "+353 01 555 0199",
      );
      expect(statusFrom(confirmResult)).toBe("confirmed");

      const secondConfirmResult = await publicConfirm(tokenA, "replace@example.com");
      expect(statusFrom(secondConfirmResult)).toBe("already_confirmed");

      const { data: confirmationRows, error: confirmationRowsError } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, contact_phone")
        .eq("booking_id", bookingAId);
      expect(confirmationRowsError).toBeNull();
      expect(confirmationRows).toHaveLength(1);
      expect(confirmationRows?.[0]).toMatchObject({
        contact_email: "new@example.com",
        contact_phone: "+353 01 555 0199",
      });
      const confirmedTermsHash = confirmationRows![0].terms_hash;

      const { data: preservedCustomer } = await service
        .from("customers")
        .select("email, phone")
        .eq("id", customerAId)
        .single();
      expect(preservedCustomer).toEqual({
        email: "existing@example.com",
        phone: "+353 01 555 0101",
      });

      const { data: confirmationEvents, error: confirmationEventsError } = await service
        .from("email_events")
        .select("id, booking_confirmation_id, recipient_email, status, attempt_count")
        .eq("booking_id", bookingAId);
      expect(confirmationEventsError).toBeNull();
      expect(confirmationEvents).toHaveLength(1);
      expect(confirmationEvents?.[0]).toMatchObject({
        booking_confirmation_id: confirmationRows?.[0].id,
        recipient_email: "new@example.com",
        status: "PENDING",
        attempt_count: 0,
      });

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
      const anonymousOpen = await anon.rpc("record_confirmation_link_open", {
        p_token_hash: hashConfirmationToken(tokenA),
      });
      expect(anonymousOpen.error).not.toBeNull();
      const { data: anonRead, error: anonReadError } = await anon
        .from("confirmation_links")
        .select("token_hash")
        .limit(1);
      expect(anonReadError).not.toBeNull();
      expectNoRows(anonRead);

      const usedViewBeforeMaterialChange = await publicView(tokenA);
      expect(statusFrom(usedViewBeforeMaterialChange)).toBe("already_confirmed");
      expect(bookingFrom(usedViewBeforeMaterialChange)?.total_amount_minor).toBe(4_500_000);
      expect(bookingFrom(usedViewBeforeMaterialChange)?.contact_email_masked).toBe(
        "n***@example.com",
      );
      expect(JSON.stringify(usedViewBeforeMaterialChange)).not.toContain("new@example.com");

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

      const emptyCustomerId = await createCustomer(
        userA.client,
        businessAId,
        "Empty Contact Customer",
        { email: null, phone: null },
      );
      const emptyContactBookingId = await createBooking(
        userA.client,
        businessAId,
        emptyCustomerId,
        userA.id,
        "Phase 6 Empty Contact Booking",
      );
      const { token: emptyContactToken } = await generateLink(
        userA.client,
        emptyContactBookingId,
      );
      expect(
        statusFrom(
          await publicConfirm(
            emptyContactToken,
            "customer@example.com",
            "+353 01 555 0177",
          ),
        ),
      ).toBe("confirmed");
      const { data: enrichedCustomer } = await service
        .from("customers")
        .select("email, phone")
        .eq("id", emptyCustomerId)
        .single();
      expect(enrichedCustomer).toEqual({
        email: "customer@example.com",
        phone: "+353 01 555 0177",
      });
      const { data: emptyContactConfirmation } = await service
        .from("booking_confirmations")
        .select("id, contact_email, contact_phone")
        .eq("booking_id", emptyContactBookingId)
        .single();
      expect(emptyContactConfirmation).toMatchObject({
        contact_email: "customer@example.com",
        contact_phone: "+353 01 555 0177",
      });
      const { data: emptyContactEvents } = await service
        .from("email_events")
        .select("id, status")
        .eq("booking_id", emptyContactBookingId);
      expect(emptyContactEvents).toHaveLength(1);

      const { data: claimedEvents, error: claimError } = await service.rpc(
        "claim_email_event",
        { p_email_event_id: emptyContactEvents![0].id },
      );
      expect(claimError).toBeNull();
      expect(claimedEvents).toHaveLength(1);
      const { error: failureUpdateError } = await service
        .from("email_events")
        .update({
          status: "FAILED",
          failure_code: "simulated_provider_failure",
          failure_message: "The simulated provider rejected the request.",
        })
        .eq("id", emptyContactEvents![0].id)
        .eq("status", "SENDING");
      expect(failureUpdateError).toBeNull();
      const [{ data: bookingAfterDeliveryFailure }, { data: eventAfterFailure }] =
        await Promise.all([
          service
            .from("bookings")
            .select("status")
            .eq("id", emptyContactBookingId)
            .single(),
          service
            .from("email_events")
            .select("status, attempt_count, failure_code")
            .eq("id", emptyContactEvents![0].id)
            .single(),
        ]);
      expect(bookingAfterDeliveryFailure?.status).toBe("CONFIRMED");
      expect(eventAfterFailure).toEqual({
        status: "FAILED",
        attempt_count: 1,
        failure_code: "simulated_provider_failure",
      });

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
      const raceEmails = ["race-one@example.com", "race-two@example.com"];
      const raceResults = await Promise.all([
        publicConfirm(raceToken, raceEmails[0]),
        publicConfirm(raceToken, raceEmails[1]),
      ]);
      expect(raceResults.map(statusFrom).sort()).toEqual(["already_confirmed", "confirmed"]);
      const { data: raceConfirmations } = await service
        .from("booking_confirmations")
        .select("id, contact_email")
        .eq("booking_id", raceBookingId);
      expect(raceConfirmations).toHaveLength(1);
      expect(raceEmails).toContain(raceConfirmations?.[0].contact_email);
      const { data: raceEvents } = await service
        .from("email_events")
        .select("id, recipient_email")
        .eq("booking_id", raceBookingId);
      expect(raceEvents).toHaveLength(1);
      expect(raceEvents?.[0].recipient_email).toBe(raceConfirmations?.[0].contact_email);

      const { token: businessBToken } = await generateLink(userB.client, bookingBId);
      expect(
        statusFrom(await publicConfirm(businessBToken, "business-b@example.com")),
      ).toBe("confirmed");

      const { data: businessBConfirmation } = await service
        .from("booking_confirmations")
        .select("id")
        .eq("booking_id", bookingBId)
        .single();
      const { data: businessBEmailEvent } = await service
        .from("email_events")
        .select("id")
        .eq("booking_id", bookingBId)
        .single();

      const { data: userAEmailEvents, error: userAEmailEventsError } = await userA.client
        .from("email_events")
        .select("recipient_email")
        .eq("business_id", businessBId);
      expect(userAEmailEventsError).not.toBeNull();
      expectNoRows(userAEmailEvents);

      const { error: userAEmailEventMutationError } = await userA.client
        .from("email_events")
        .update({ failure_code: "cross_tenant_mutation" })
        .eq("id", businessBEmailEvent!.id);
      expect(userAEmailEventMutationError).not.toBeNull();

      const { data: userAConfirmationRows, error: userAConfirmationReadError } =
        await userA.client
          .from("booking_confirmations")
          .select("contact_email")
          .eq("id", businessBConfirmation!.id);
      expect(userAConfirmationReadError).not.toBeNull();
      expectNoRows(userAConfirmationRows);

      const bookingConfirmationsAttackTable = userA.client.from(
        "booking_confirmations",
      ) as unknown as {
        update(values: Record<string, unknown>): {
          eq(column: string, value: string): PromiseLike<{ error: unknown }>;
        };
      };
      const { error: userAConfirmationMutationError } =
        await bookingConfirmationsAttackTable
          .update({ contact_phone: "+353 01 555 0999" })
          .eq("id", businessBConfirmation!.id);
      expect(userAConfirmationMutationError).not.toBeNull();

      const { data: anonEmailEvents, error: anonEmailEventsError } = await anon
        .from("email_events")
        .select("recipient_email")
        .limit(1);
      expect(anonEmailEventsError).not.toBeNull();
      expectNoRows(anonEmailEvents);

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
        .select("event_type, metadata")
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
      expect(JSON.stringify(auditRows)).not.toContain("new@example.com");
    }, 180_000);

    afterAll(async () => {
      if (createdRateBuckets.length > 0) {
        await service.from("confirmation_rate_limits").delete().in("bucket_key", createdRateBuckets);
      }

      if (createdBookingIds.length > 0) {
        await service.from("email_events").delete().in("booking_id", createdBookingIds);
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
