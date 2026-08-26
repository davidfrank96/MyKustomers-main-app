import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database, Json } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { generateAmendmentToken, hashAmendmentToken } from "@/features/amendments/token";
import { generateFeedbackToken, hashFeedbackToken } from "@/features/feedback/token";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "booking amendments",
  storagePrefix: "booking-amendments-runtime",
});

type AppClient = SupabaseClient<Database>;
type UserFixture = { id: string; client: AppClient };

function statusOf(value: unknown) {
  return value && typeof value === "object" && "status" in value
    ? (value as { status: unknown }).status
    : null;
}

if (runtime.enabled) {
  describe("booking amendments runtime", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const untypedService = service as unknown as SupabaseClient;
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `${Date.now()}-${randomUUID()}`;
    const userIds: string[] = [];
    const businessIds: string[] = [];
    const customerIds: string[] = [];
    const bookingIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `amendment-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Amendment-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      userIds.push(data.user!.id);
      const client = runtime.createSupabaseClient(publishableKey);
      expect(
        (await client.auth.signInWithPassword({ email, password })).error,
      ).toBeNull();
      return { id: data.user!.id, client };
    }

    async function createBusiness(userId: string, label: string) {
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Amendment ${label}`,
          slug: `amendment-${label.toLowerCase()}-${randomUUID().slice(0, 8)}`,
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

    async function createCustomer(client: AppClient, businessId: string, email: string) {
      const { data, error } = await client
        .from("customers")
        .insert({ business_id: businessId, name: "Amendment Customer", email })
        .select("id")
        .single();
      expect(error).toBeNull();
      customerIds.push(data!.id);
      return data!.id;
    }

    async function createConfirmedBooking(
      owner: UserFixture,
      businessId: string,
      customerId: string,
      label: string,
    ) {
      const scheduledFor = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const { data: booking, error } = await owner.client
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title: `${label} original`,
          description: "Original customer-agreed details",
          currency: "EUR",
          total_amount_minor: 45_000,
          deposit_amount_minor: 5_000,
          scheduled_for: scheduledFor,
          created_by: owner.id,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      bookingIds.push(booking!.id);

      const token = generateConfirmationToken();
      const tokenHash = hashConfirmationToken(token);
      expect(
        (
          await owner.client.rpc("create_booking_confirmation_link", {
            p_booking_id: booking!.id,
            p_token_hash: tokenHash,
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).toBeNull();
      const { data: confirmed, error: confirmError } = await service.rpc(
        "confirm_booking_by_token_hash",
        {
          p_token_hash: tokenHash,
          p_contact_email: "agreement-contact@example.com",
        },
      );
      expect(confirmError).toBeNull();
      expect(statusOf(confirmed)).toBe("confirmed");
      return { bookingId: booking!.id, originalTokenHash: tokenHash, scheduledFor };
    }

    async function createAmendment(
      owner: UserFixture,
      bookingId: string,
      suffix: string,
      expiresAt = new Date(Date.now() + 86_400_000),
    ) {
      const token = generateAmendmentToken();
      const tokenHash = hashAmendmentToken(token);
      const { data, error } = await owner.client.rpc("create_booking_amendment", {
        p_booking_id: bookingId,
        p_reason: `Customer requested ${suffix}.`,
        p_title: `Amended ${suffix}`,
        p_description: `Proposed details ${suffix}`,
        p_currency: "EUR",
        p_total_amount_minor: 55_000,
        p_deposit_amount_minor: 7_000,
        p_scheduled_for: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        p_token_hash: tokenHash,
        p_expires_at: expiresAt.toISOString(),
      });
      expect(error, error?.message).toBeNull();
      expect(data?.[0]).toBeTruthy();
      return { token, tokenHash, result: data![0] };
    }

    it("enforces secure proposal, confirmation, history, failure, and tenant behavior", async () => {
      const ownerA = await createUser("owner-a");
      const ownerB = await createUser("owner-b");
      const businessA = await createBusiness(ownerA.id, "A");
      const businessB = await createBusiness(ownerB.id, "B");
      const customerA = await createCustomer(
        ownerA.client,
        businessA,
        "customer-row@example.com",
      );
      const customerB = await createCustomer(
        ownerB.client,
        businessB,
        "other@example.com",
      );
      const main = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Main amendment",
      );
      const { data: originalEvidence } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
        .eq("booking_id", main.bookingId)
        .single();

      const first = await createAmendment(ownerA, main.bookingId, "first proposal");
      const { data: canonicalBefore } = await service
        .from("bookings")
        .select("title, total_amount_minor, deposit_amount_minor, scheduled_for, status")
        .eq("id", main.bookingId)
        .single();
      expect(canonicalBefore).toMatchObject({
        title: "Main amendment original",
        total_amount_minor: 45_000,
        deposit_amount_minor: 5_000,
        status: "IN_PROGRESS",
      });
      expect(new Date(canonicalBefore!.scheduled_for!).getTime()).toBe(
        new Date(main.scheduledFor).getTime(),
      );

      const second = await createAmendment(ownerA, main.bookingId, "larger scope");
      const { data: replaced } = await service
        .from("booking_amendments")
        .select("status, revoked_reason")
        .eq("id", first.result.amendment_id)
        .single();
      expect(replaced).toEqual({ status: "REVOKED", revoked_reason: "replaced" });
      expect(second.result.replaced_amendment_count).toBe(1);

      const { data: proposal } = await service
        .from("booking_amendments")
        .select(
          "token_hash, purpose, old_terms, proposed_terms, changed_fields, contact_email",
        )
        .eq("id", second.result.amendment_id)
        .single();
      expect(proposal?.token_hash).toBe(second.tokenHash);
      expect(proposal?.token_hash).not.toBe(second.token);
      expect(proposal).toMatchObject({
        purpose: "booking_amendment_confirmation",
        contact_email: "agreement-contact@example.com",
      });
      expect(proposal?.changed_fields).toEqual([
        "title",
        "description",
        "total_amount_minor",
        "deposit_amount_minor",
        "scheduled_for",
      ]);
      expect((proposal?.old_terms as Record<string, Json>).total_amount_minor).toBe(
        45_000,
      );
      expect((proposal?.proposed_terms as Record<string, Json>).total_amount_minor).toBe(
        55_000,
      );

      const { data: requestEvent } = await service
        .from("email_events")
        .select("id, status, recipient_email")
        .eq("booking_amendment_id", second.result.amendment_id)
        .eq("event_type", "BOOKING_AMENDMENT_REQUESTED")
        .single();
      expect(requestEvent).toMatchObject({
        status: "PENDING",
        recipient_email: "agreement-contact@example.com",
      });
      expect(
        (
          await service.rpc("claim_email_event", {
            p_email_event_id: requestEvent!.id,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await service
            .from("email_events")
            .update({
              status: "FAILED",
              failure_code: "synthetic_request_failure",
              failure_message: "Synthetic request provider failure.",
            })
            .eq("id", requestEvent!.id)
            .eq("status", "SENDING")
        ).error,
      ).toBeNull();
      expect(
        (
          await untypedService
            .from("booking_amendments")
            .select("status")
            .eq("id", second.result.amendment_id)
            .single()
        ).data?.status,
      ).toBe("PENDING_CUSTOMER");

      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: main.originalTokenHash,
            })
          ).data,
        ),
      ).toBe("unavailable");
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_by_token_hash", {
              p_token_hash: second.tokenHash,
              p_contact_email: "agreement-contact@example.com",
            })
          ).data,
        ),
      ).toBe("unavailable");
      const feedbackToken = generateFeedbackToken();
      const feedbackHash = hashFeedbackToken(feedbackToken);
      expect(
        (
          await service.from("feedback_links").insert({
            business_id: businessA,
            booking_id: main.bookingId,
            token_hash: feedbackHash,
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            created_by: ownerA.id,
          })
        ).error,
      ).toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: feedbackHash,
            })
          ).data,
        ),
      ).toBe("unavailable");

      const anon = runtime.createSupabaseClient(publishableKey);
      expect(
        (
          await anon.rpc("confirm_booking_amendment_by_token_hash", {
            p_token_hash: second.tokenHash,
          })
        ).error,
      ).not.toBeNull();
      const { data: crossTenantRows } = await ownerB.client
        .from("booking_amendments")
        .select("id")
        .eq("id", second.result.amendment_id);
      expectNoRows(crossTenantRows);
      expect(
        (
          await ownerB.client.rpc("revoke_booking_amendment", {
            p_amendment_id: second.result.amendment_id,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerB.client.rpc("create_booking_amendment", {
            p_booking_id: main.bookingId,
            p_reason: "Cross tenant",
            p_title: "Cross tenant",
            p_description: null,
            p_currency: "EUR",
            p_total_amount_minor: 10,
            p_deposit_amount_minor: 0,
            p_scheduled_for: null,
            p_token_hash: hashAmendmentToken(generateAmendmentToken()),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).not.toBeNull();

      const publicView = await service.rpc("get_booking_amendment_public_view", {
        p_token_hash: second.tokenHash,
      });
      expect(publicView.error).toBeNull();
      expect(statusOf(publicView.data)).toBe("valid");

      const race = await Promise.all([
        service.rpc("confirm_booking_amendment_by_token_hash", {
          p_token_hash: second.tokenHash,
        }),
        service.rpc("confirm_booking_amendment_by_token_hash", {
          p_token_hash: second.tokenHash,
        }),
      ]);
      expect(
        race.every((result) => result.error === null),
        race
          .map((result) => result.error?.message ?? String(statusOf(result.data)))
          .join(" | "),
      ).toBe(true);
      expect(race.map((result) => statusOf(result.data)).sort()).toEqual([
        "already_confirmed",
        "confirmed",
      ]);

      const [
        { data: effective },
        { data: appliedChanges },
        { data: confirmationEvents },
      ] = await Promise.all([
        service
          .from("bookings")
          .select(
            "title, description, total_amount_minor, deposit_amount_minor, status, confirmation_terms_hash",
          )
          .eq("id", main.bookingId)
          .single(),
        service
          .from("booking_changes")
          .select("id, changed_fields")
          .eq("amendment_id", second.result.amendment_id),
        service
          .from("email_events")
          .select("id, status, recipient_email")
          .eq("booking_amendment_id", second.result.amendment_id)
          .eq("event_type", "BOOKING_AMENDMENT_CONFIRMED"),
      ]);
      expect(effective).toMatchObject({
        title: "Amended larger scope",
        description: "Proposed details larger scope",
        total_amount_minor: 55_000,
        deposit_amount_minor: 7_000,
        status: "IN_PROGRESS",
      });
      expect(effective?.confirmation_terms_hash).toBeTruthy();
      expect(appliedChanges).toHaveLength(1);
      expect(confirmationEvents).toHaveLength(1);
      expect(confirmationEvents?.[0].recipient_email).toBe(
        "agreement-contact@example.com",
      );

      expect(
        (
          await ownerA.client
            .from("bookings")
            .update({ title: "Crafted direct edit" })
            .eq("id", main.bookingId)
        ).error,
      ).not.toBeNull();
      expect(
        (
          await service.rpc("claim_email_event", {
            p_email_event_id: confirmationEvents![0].id,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await service
            .from("email_events")
            .update({
              status: "FAILED",
              failure_code: "synthetic_confirmation_failure",
              failure_message: "Synthetic confirmation provider failure.",
            })
            .eq("id", confirmationEvents![0].id)
            .eq("status", "SENDING")
        ).error,
      ).toBeNull();
      expect(
        (await service.from("bookings").select("title").eq("id", main.bookingId).single())
          .data?.title,
      ).toBe("Amended larger scope");
      const { data: evidenceAfter } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
        .eq("booking_id", main.bookingId)
        .single();
      expect(evidenceAfter).toEqual(originalEvidence);

      const { data: insight } = await ownerA.client.rpc("get_business_insights", {
        p_business_id: businessA,
        p_from: new Date(Date.now() - 86_400_000).toISOString(),
        p_to: new Date(Date.now() + 86_400_000).toISOString(),
      });
      const recorded =
        (insight && typeof insight === "object" && "value" in insight
          ? (
              insight.value as {
                recorded?: Array<{
                  currency: string;
                  amountMinor: number;
                  bookingCount: number;
                }>;
              }
            ).recorded
          : []) ?? [];
      const eur = recorded.find((row) => row.currency === "EUR");
      expect(eur?.amountMinor).toBeGreaterThanOrEqual(55_000);
      expect(eur?.bookingCount).toBeGreaterThanOrEqual(1);

      const revokeBooking = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Revoke",
      );
      const revokeAmendment = await createAmendment(
        ownerA,
        revokeBooking.bookingId,
        "revoke",
      );
      expect(
        (
          await ownerA.client.rpc("revoke_booking_amendment", {
            p_amendment_id: revokeAmendment.result.amendment_id,
          })
        ).data,
      ).toBe(true);
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: revokeAmendment.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");
      expect(
        (
          await service
            .from("bookings")
            .select("title")
            .eq("id", revokeBooking.bookingId)
            .single()
        ).data?.title,
      ).toBe("Revoke original");

      const cancelBooking = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Cancel",
      );
      const cancelAmendment = await createAmendment(
        ownerA,
        cancelBooking.bookingId,
        "cancel",
      );
      expect(
        (
          await ownerA.client.rpc("transition_booking_status", {
            p_booking_id: cancelBooking.bookingId,
            p_to_status: "CANCELLED",
            p_cancellation_reason: "Customer cancelled before approving changes",
          })
        ).error,
      ).toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: cancelAmendment.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");
      expect(
        (
          await service
            .from("booking_amendments")
            .select("status, revoked_reason")
            .eq("id", cancelAmendment.result.amendment_id)
            .single()
        ).data,
      ).toEqual({
        status: "REVOKED",
        revoked_reason: "booking_cancelled",
      });

      const staleBooking = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Stale",
      );
      const staleAmendment = await createAmendment(
        ownerA,
        staleBooking.bookingId,
        "stale",
      );
      expect(
        (
          await untypedService
            .from("booking_amendments")
            .update({ base_terms_hash: "0".repeat(64) })
            .eq("id", staleAmendment.result.amendment_id)
        ).error,
      ).toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: staleAmendment.tokenHash,
            })
          ).data,
        ),
      ).toBe("stale");
      expect(
        (
          await service
            .from("bookings")
            .select("title")
            .eq("id", staleBooking.bookingId)
            .single()
        ).data?.title,
      ).toBe("Stale original");

      const expiredBooking = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Expired",
      );
      const expiredAmendment = await createAmendment(
        ownerA,
        expiredBooking.bookingId,
        "expired",
        new Date(Date.now() + 1_000),
      );
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: expiredAmendment.tokenHash,
            })
          ).data,
        ),
      ).toBe("expired");

      const otherBooking = await createConfirmedBooking(
        ownerB,
        businessB,
        customerB,
        "Other",
      );
      expect(otherBooking.bookingId).toBeTruthy();
    }, 90_000);

    afterAll(async () => {
      if (bookingIds.length > 0) {
        await service.from("email_events").delete().in("booking_id", bookingIds);
        await service.from("booking_changes").delete().in("booking_id", bookingIds);
        await service.from("booking_amendments").delete().in("booking_id", bookingIds);
        await service.from("feedback").delete().in("booking_id", bookingIds);
        await service.from("feedback_links").delete().in("booking_id", bookingIds);
        await service.from("booking_confirmations").delete().in("booking_id", bookingIds);
        await service.from("confirmation_links").delete().in("booking_id", bookingIds);
        await service
          .from("booking_status_history")
          .delete()
          .in("booking_id", bookingIds);
        await service.from("bookings").delete().in("id", bookingIds);
      }
      if (customerIds.length > 0)
        await service.from("customers").delete().in("id", customerIds);
      if (businessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("business_members").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(userIds.map((id) => service.auth.admin.deleteUser(id)));
    });
  });
} else {
  describe.skip("booking amendments runtime", () => {
    it("requires explicit safe runtime configuration", () => {});
  });
}
