import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database, Json } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { generateAddonToken, hashAddonToken } from "@/features/addons/token";
import { generateAmendmentToken, hashAmendmentToken } from "@/features/amendments/token";
import { generateFeedbackToken, hashFeedbackToken } from "@/features/feedback/token";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "booking add-ons",
  storagePrefix: "booking-addons-runtime",
});

type AppClient = SupabaseClient<Database>;
type UserFixture = { id: string; client: AppClient };

function statusOf(value: unknown) {
  return value && typeof value === "object" && "status" in value
    ? (value as { status: unknown }).status
    : null;
}

function metric(
  data: Json | null,
  section: "recorded" | "completed" | "average" | "deposits",
  currency: string,
) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rows = value[section];
  if (!Array.isArray(rows)) return null;
  return rows.find(
    (row) =>
      row && typeof row === "object" && !Array.isArray(row) && row.currency === currency,
  ) as { amountMinor?: number; bookingCount?: number } | undefined;
}

if (runtime.enabled) {
  describe("booking add-ons runtime", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const untypedService = service as unknown as SupabaseClient;
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const anon = runtime.createSupabaseClient(publishableKey);
    const fixtureId = `${Date.now()}-${randomUUID()}`;
    const userIds: string[] = [];
    const businessIds: string[] = [];
    const customerIds: string[] = [];
    const bookingIds: string[] = [];

    async function createUser(label: string): Promise<UserFixture> {
      const email = `addon-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Addon-${label}-${randomUUID()}-A1`;
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
          name: `Addon Runtime ${label}`,
          slug: `addon-runtime-${label.toLowerCase()}-${randomUUID().slice(0, 8)}`,
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
        .insert({ business_id: businessId, name: "Addon Customer", email })
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
          title: `${label} booking`,
          description: "Original customer-agreed scope",
          currency: "EUR",
          total_amount_minor: 45_000,
          deposit_amount_minor: 20_000,
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
          p_contact_phone: "+353 1 555 0199",
        },
      );
      expect(confirmError).toBeNull();
      expect(statusOf(confirmed)).toBe("confirmed");
      return { bookingId: booking!.id, token, tokenHash, scheduledFor };
    }

    async function createAddon(
      owner: UserFixture,
      bookingId: string,
      title: string,
      total: number,
      deposit: number,
    ) {
      const { data, error } = await owner.client.rpc("create_booking_addon", {
        p_booking_id: bookingId,
        p_title: title,
        p_description: `${title} details`,
        p_total_amount_minor: total,
        p_deposit_amount_minor: deposit,
      });
      expect(error, error?.message).toBeNull();
      expect(data?.[0]).toBeTruthy();
      return data![0].booking_addon_id;
    }

    async function submitAddon(owner: UserFixture, addonId: string) {
      const token = generateAddonToken();
      const tokenHash = hashAddonToken(token);
      const { data, error } = await owner.client.rpc("submit_booking_addon", {
        p_booking_addon_id: addonId,
        p_token_hash: tokenHash,
        p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(error, error?.message).toBeNull();
      expect(data?.[0]).toBeTruthy();
      return { token, tokenHash, result: data![0] };
    }

    async function transition(
      owner: UserFixture,
      bookingId: string,
      to: Database["public"]["Enums"]["booking_status"],
      reason?: string,
    ) {
      const { error } = await owner.client.rpc("transition_booking_status", {
        p_booking_id: bookingId,
        p_to_status: to,
        p_cancellation_reason: reason ?? null,
      });
      expect(error, error?.message).toBeNull();
    }

    it("enforces secure add-on confirmation, totals, lifecycle, and tenant behavior", async () => {
      const ownerA = await createUser("owner-a");
      const ownerB = await createUser("owner-b");
      const businessA = await createBusiness(ownerA.id, "A");
      const businessB = await createBusiness(ownerB.id, "B");
      const customerA = await createCustomer(
        ownerA.client,
        businessA,
        "conflicting-current-customer@example.com",
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
        "Main add-on",
      );
      const { data: originalEvidence } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
        .eq("booking_id", main.bookingId)
        .single();

      expect(
        (
          await ownerB.client.rpc("create_booking_addon", {
            p_booking_id: main.bookingId,
            p_title: "Cross tenant",
            p_description: null,
            p_total_amount_minor: 1_000,
            p_deposit_amount_minor: 0,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await anon.rpc("create_booking_addon", {
            p_booking_id: main.bookingId,
            p_title: "Anonymous",
            p_description: null,
            p_total_amount_minor: 1_000,
            p_deposit_amount_minor: 0,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerA.client.rpc("create_booking_addon", {
            p_booking_id: main.bookingId,
            p_title: "Negative",
            p_description: null,
            p_total_amount_minor: -1,
            p_deposit_amount_minor: 0,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerA.client.rpc("create_booking_addon", {
            p_booking_id: main.bookingId,
            p_title: "Deposit too high",
            p_description: null,
            p_total_amount_minor: 1_000,
            p_deposit_amount_minor: 1_001,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerA.client.rpc("create_booking_addon", {
            p_booking_id: main.bookingId,
            p_title: "Unsafe integer",
            p_description: null,
            p_total_amount_minor: 9_007_199_254_740_992,
            p_deposit_amount_minor: 0,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await untypedService.from("booking_addons").insert({
            business_id: businessA,
            booking_id: main.bookingId,
            created_by: ownerA.id,
            title: "Wrong currency",
            currency: "USD",
            total_amount_minor: 1_000,
            deposit_amount_minor: 0,
          })
        ).error?.message,
      ).toContain("booking_addon_currency_mismatch");

      const firstAddonId = await createAddon(
        ownerA,
        main.bookingId,
        "24 Cupcakes",
        18_000,
        5_000,
      );
      const { data: canonicalBefore } = await service
        .from("bookings")
        .select(
          "title, total_amount_minor, deposit_amount_minor, confirmation_terms_hash",
        )
        .eq("id", main.bookingId)
        .single();
      expect(canonicalBefore).toMatchObject({
        title: "Main add-on booking",
        total_amount_minor: 45_000,
        deposit_amount_minor: 20_000,
      });

      const firstRequest = await submitAddon(ownerA, firstAddonId);
      const { data: stored } = await service
        .from("booking_addons")
        .select(
          "status, currency, terms_snapshot, terms_hash, confirmation_contact_email",
        )
        .eq("id", firstAddonId)
        .single();
      expect(stored).toMatchObject({
        status: "AWAITING_CUSTOMER",
        currency: "EUR",
        confirmation_contact_email: "agreement-contact@example.com",
      });
      expect(stored?.terms_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(stored?.terms_snapshot).toMatchObject({
        title: "24 Cupcakes",
        total_amount_minor: 18_000,
      });
      const inheritedSchedule =
        stored?.terms_snapshot &&
        typeof stored.terms_snapshot === "object" &&
        !Array.isArray(stored.terms_snapshot)
          ? stored.terms_snapshot.inherited_scheduled_for
          : null;
      expect(new Date(String(inheritedSchedule)).getTime()).toBe(
        new Date(main.scheduledFor).getTime(),
      );

      const { data: requestEvent } = await service
        .from("email_events")
        .select("id, status, recipient_email")
        .eq(
          "booking_addon_confirmation_link_id",
          firstRequest.result.confirmation_link_id,
        )
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
        ).error,
      ).toBeNull();
      expect(
        (
          await service
            .from("booking_addons")
            .select("status")
            .eq("id", firstAddonId)
            .single()
        ).data?.status,
      ).toBe("AWAITING_CUSTOMER");

      const conflictingDraftId = await createAddon(
        ownerA,
        main.bookingId,
        "Conflicting draft",
        2_000,
        0,
      );
      expect(
        (
          await ownerA.client.rpc("submit_booking_addon", {
            p_booking_addon_id: conflictingDraftId,
            p_token_hash: hashAddonToken(generateAddonToken()),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error?.message,
      ).toContain("booking_has_pending_addon_request");

      const amendmentToken = generateAmendmentToken();
      const amendmentHash = hashAmendmentToken(amendmentToken);
      expect(
        (
          await ownerA.client.rpc("create_booking_amendment", {
            p_booking_id: main.bookingId,
            p_reason: "Conflicting request",
            p_title: "Changed original scope",
            p_description: "Must be blocked",
            p_currency: "EUR",
            p_total_amount_minor: 50_000,
            p_deposit_amount_minor: 20_000,
            p_scheduled_for: main.scheduledFor,
            p_token_hash: amendmentHash,
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error?.message,
      ).toContain("booking_has_pending_addon_request");

      const replacement = await submitAddon(ownerA, firstAddonId);
      expect(replacement.result.replaced_link_count).toBe(1);
      expect(
        (
          await service
            .from("booking_addon_confirmation_links")
            .select("revoked_reason")
            .eq("id", firstRequest.result.confirmation_link_id)
            .single()
        ).data?.revoked_reason,
      ).toBe("replaced");
      expect(
        statusOf(
          (
            await service.rpc("get_booking_addon_public_view", {
              p_token_hash: firstRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");
      const publicView = await service.rpc("get_booking_addon_public_view", {
        p_token_hash: replacement.tokenHash,
      });
      expect(publicView.error).toBeNull();
      expect(statusOf(publicView.data)).toBe("valid");
      expect(JSON.stringify(publicView.data)).not.toContain(
        "agreement-contact@example.com",
      );
      expect(JSON.stringify(publicView.data)).not.toContain(customerA);
      expect(
        (
          await service.rpc("record_booking_addon_open", {
            p_token_hash: replacement.tokenHash,
          })
        ).data,
      ).toBe(true);

      expect(
        (
          await anon.rpc("get_booking_addon_public_view", {
            p_token_hash: replacement.tokenHash,
          })
        ).error,
      ).not.toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_by_token_hash", {
              p_token_hash: replacement.tokenHash,
              p_contact_email: "attacker@example.com",
              p_contact_phone: null,
            })
          ).data,
        ),
      ).toBe("unavailable");
      expect(
        statusOf(
          (
            await service.rpc("get_booking_addon_public_view", {
              p_token_hash: main.tokenHash,
            })
          ).data,
        ),
      ).toBe("unavailable");
      expect(
        statusOf(
          (
            await service.rpc("get_booking_amendment_public_view", {
              p_token_hash: replacement.tokenHash,
            })
          ).data,
        ),
      ).toBe("unavailable");
      expect(
        statusOf(
          (
            await service.rpc("submit_feedback_by_token_hash", {
              p_token_hash: replacement.tokenHash,
              p_overall_rating: 5,
              p_on_time: true,
              p_met_expectations: true,
              p_comment: null,
            })
          ).data,
        ),
      ).toBe("unavailable");

      const confirmations = await Promise.all([
        service.rpc("confirm_booking_addon_by_token_hash", {
          p_token_hash: replacement.tokenHash,
        }),
        service.rpc("confirm_booking_addon_by_token_hash", {
          p_token_hash: replacement.tokenHash,
        }),
      ]);
      expect(confirmations.every((result) => result.error === null)).toBe(true);
      expect(confirmations.map((result) => statusOf(result.data)).sort()).toEqual([
        "already_confirmed",
        "confirmed",
      ]);
      const [
        { data: firstConfirmed },
        { data: firstConfirmationEvents },
        { data: firstAudit },
      ] = await Promise.all([
        service
          .from("booking_addons")
          .select("status, confirmed_at")
          .eq("id", firstAddonId)
          .single(),
        service
          .from("email_events")
          .select("id, status")
          .eq("booking_addon_id", firstAddonId)
          .eq("event_type", "BOOKING_ADDON_CONFIRMED"),
        service
          .from("audit_logs")
          .select("id")
          .eq("business_id", businessA)
          .eq("event_type", "BOOKING_ADDON_CONFIRMED")
          .contains("metadata", { booking_addon_id: firstAddonId }),
      ]);
      expect(firstConfirmed?.status).toBe("CONFIRMED");
      expect(firstConfirmed?.confirmed_at).toBeTruthy();
      expect(firstConfirmationEvents).toHaveLength(1);
      expect(firstAudit).toHaveLength(1);

      expect(
        (
          await ownerA.client
            .from("booking_addons")
            .update({ title: "Crafted customer edit" } as never)
            .eq("id", firstAddonId)
        ).error,
      ).not.toBeNull();
      expect(
        (
          await untypedService
            .from("booking_addons")
            .update({ title: "Crafted service edit" })
            .eq("id", firstAddonId)
        ).error?.message,
      ).toContain("booking_addon_terms_immutable");
      expectNoRows(
        (await ownerB.client.from("booking_addons").select("id").eq("id", firstAddonId))
          .data,
      );
      expect(
        (
          await ownerB.client.rpc("cancel_booking_addon", {
            p_booking_addon_id: firstAddonId,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await ownerA.client.rpc("cancel_booking_addon", {
            p_booking_addon_id: firstAddonId,
          })
        ).error?.message,
      ).toContain("confirmed_booking_addon_is_immutable");

      const confirmationEventId = firstConfirmationEvents![0].id;
      expect(
        (
          await service.rpc("claim_email_event", {
            p_email_event_id: confirmationEventId,
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
            .eq("id", confirmationEventId)
        ).error,
      ).toBeNull();
      expect(
        (
          await service
            .from("booking_addons")
            .select("status")
            .eq("id", firstAddonId)
            .single()
        ).data?.status,
      ).toBe("CONFIRMED");

      expect(
        (
          await ownerA.client.rpc("cancel_booking_addon", {
            p_booking_addon_id: conflictingDraftId,
          })
        ).error,
      ).toBeNull();

      const actualAmendmentToken = generateAmendmentToken();
      const actualAmendmentHash = hashAmendmentToken(actualAmendmentToken);
      const { data: amendmentData, error: amendmentError } = await ownerA.client.rpc(
        "create_booking_amendment",
        {
          p_booking_id: main.bookingId,
          p_reason: "Purpose separation test",
          p_title: "Changed original scope",
          p_description: "Purpose separation",
          p_currency: "EUR",
          p_total_amount_minor: 50_000,
          p_deposit_amount_minor: 20_000,
          p_scheduled_for: main.scheduledFor,
          p_token_hash: actualAmendmentHash,
          p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
      expect(amendmentError, amendmentError?.message).toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("get_booking_addon_public_view", {
              p_token_hash: actualAmendmentHash,
            })
          ).data,
        ),
      ).toBe("unavailable");

      const blockedByAmendmentId = await createAddon(
        ownerA,
        main.bookingId,
        "Blocked by amendment",
        3_000,
        0,
      );
      expect(
        (
          await ownerA.client.rpc("submit_booking_addon", {
            p_booking_addon_id: blockedByAmendmentId,
            p_token_hash: hashAddonToken(generateAddonToken()),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error?.message,
      ).toContain("booking_has_pending_amendment_request");
      expect(
        (
          await ownerA.client.rpc("revoke_booking_amendment", {
            p_amendment_id: amendmentData![0].amendment_id,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await ownerA.client.rpc("cancel_booking_addon", {
            p_booking_addon_id: blockedByAmendmentId,
          })
        ).error,
      ).toBeNull();

      const secondAddonId = await createAddon(
        ownerA,
        main.bookingId,
        "Decoration package",
        7_000,
        1_000,
      );
      const { data: beforeSecondInsight } = await ownerA.client.rpc(
        "get_business_insights",
        {
          p_business_id: businessA,
          p_from: new Date(Date.now() - 86_400_000).toISOString(),
          p_to: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
      expect(metric(beforeSecondInsight, "recorded", "EUR")).toMatchObject({
        amountMinor: 63_000,
        bookingCount: 1,
      });
      const secondRequest = await submitAddon(ownerA, secondAddonId);
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_addon_by_token_hash", {
              p_token_hash: secondRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("confirmed");
      const { data: multipleInsight } = await ownerA.client.rpc("get_business_insights", {
        p_business_id: businessA,
        p_from: new Date(Date.now() - 86_400_000).toISOString(),
        p_to: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(metric(multipleInsight, "recorded", "EUR")).toMatchObject({
        amountMinor: 70_000,
        bookingCount: 1,
      });
      expect(metric(multipleInsight, "average", "EUR")).toMatchObject({
        amountMinor: 70_000,
        bookingCount: 1,
      });
      expect(metric(multipleInsight, "deposits", "EUR")).toMatchObject({
        amountMinor: 26_000,
        bookingCount: 1,
      });

      const ineligible = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Ineligible",
      );
      const ineligibleAddonId = await createAddon(
        ownerA,
        ineligible.bookingId,
        "Late addition",
        2_000,
        0,
      );
      const ineligibleRequest = await submitAddon(ownerA, ineligibleAddonId);
      await transition(ownerA, ineligible.bookingId, "IN_PROGRESS");
      await transition(ownerA, ineligible.bookingId, "READY");
      expect(
        (
          await service
            .from("booking_addons")
            .select("status")
            .eq("id", ineligibleAddonId)
            .single()
        ).data?.status,
      ).toBe("CANCELLED");
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_addon_by_token_hash", {
              p_token_hash: ineligibleRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");

      const pendingCancellation = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Pending cancellation",
      );
      const pendingCancellationAddonId = await createAddon(
        ownerA,
        pendingCancellation.bookingId,
        "Pending cancellation add-on",
        4_000,
        0,
      );
      const pendingCancellationRequest = await submitAddon(
        ownerA,
        pendingCancellationAddonId,
      );
      await transition(
        ownerA,
        pendingCancellation.bookingId,
        "CANCELLED",
        "Customer cancelled the booking",
      );
      expect(
        (
          await service
            .from("booking_addons")
            .select("status, cancellation_reason")
            .eq("id", pendingCancellationAddonId)
            .single()
        ).data,
      ).toEqual({ status: "CANCELLED", cancellation_reason: "booking_cancelled" });
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_addon_by_token_hash", {
              p_token_hash: pendingCancellationRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");

      const feedbackBooking = await createConfirmedBooking(
        ownerA,
        businessA,
        customerA,
        "Feedback purpose",
      );
      await transition(ownerA, feedbackBooking.bookingId, "IN_PROGRESS");
      await transition(ownerA, feedbackBooking.bookingId, "READY");
      await transition(ownerA, feedbackBooking.bookingId, "DELIVERED");
      await transition(ownerA, feedbackBooking.bookingId, "COMPLETED");
      const feedbackToken = generateFeedbackToken();
      const feedbackHash = hashFeedbackToken(feedbackToken);
      expect(
        (
          await ownerA.client.rpc("create_booking_feedback_link", {
            p_booking_id: feedbackBooking.bookingId,
            p_token_hash: feedbackHash,
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).toBeNull();
      expect(
        statusOf(
          (
            await service.rpc("get_booking_addon_public_view", {
              p_token_hash: feedbackHash,
            })
          ).data,
        ),
      ).toBe("unavailable");

      await transition(
        ownerA,
        main.bookingId,
        "CANCELLED",
        "Customer cancelled the complete booking",
      );
      const { data: confirmedAfterCancellation } = await service
        .from("booking_addons")
        .select("id, status")
        .in("id", [firstAddonId, secondAddonId]);
      expect(confirmedAfterCancellation).toHaveLength(2);
      expect(
        confirmedAfterCancellation?.every((addon) => addon.status === "CONFIRMED"),
      ).toBe(true);
      const { data: evidenceAfter } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
        .eq("booking_id", main.bookingId)
        .single();
      expect(evidenceAfter).toEqual(originalEvidence);
      expect(canonicalBefore?.confirmation_terms_hash).toBe(originalEvidence?.terms_hash);

      const otherBooking = await createConfirmedBooking(
        ownerB,
        businessB,
        customerB,
        "Other tenant",
      );
      expect(otherBooking.bookingId).toBeTruthy();
    }, 90_000);

    it("preserves every agreement layer through amendment, add-on, and cancellation", async () => {
      const owner = await createUser("integrity-owner");
      const businessId = await createBusiness(owner.id, "Integrity");
      const customerId = await createCustomer(
        owner.client,
        businessId,
        "integrity-customer@example.com",
      );
      const booking = await createConfirmedBooking(
        owner,
        businessId,
        customerId,
        "Agreement integrity",
      );
      const { data: originalConfirmation } = await service
        .from("booking_confirmations")
        .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
        .eq("booking_id", booking.bookingId)
        .single();
      expect(originalConfirmation?.terms_snapshot).toMatchObject({
        total_amount_minor: 45_000,
      });

      const amendmentToken = generateAmendmentToken();
      const { data: amendmentResult, error: amendmentError } = await owner.client.rpc(
        "create_booking_amendment",
        {
          p_booking_id: booking.bookingId,
          p_reason: "Customer approved a larger original scope",
          p_title: "Agreement integrity booking",
          p_description: "Amended customer-agreed scope",
          p_currency: "EUR",
          p_total_amount_minor: 55_000,
          p_deposit_amount_minor: 20_000,
          p_scheduled_for: booking.scheduledFor,
          p_token_hash: hashAmendmentToken(amendmentToken),
          p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
      expect(amendmentError, amendmentError?.message).toBeNull();
      const amendmentId = amendmentResult![0].amendment_id;
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_amendment_by_token_hash", {
              p_token_hash: hashAmendmentToken(amendmentToken),
            })
          ).data,
        ),
      ).toBe("confirmed");

      const addonId = await createAddon(
        owner,
        booking.bookingId,
        "Confirmed integrity add-on",
        18_000,
        5_000,
      );
      const addonRequest = await submitAddon(owner, addonId);
      expect(
        statusOf(
          (
            await service.rpc("confirm_booking_addon_by_token_hash", {
              p_token_hash: addonRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("confirmed");

      const { data: effectiveInsights } = await owner.client.rpc(
        "get_business_insights",
        {
          p_business_id: businessId,
          p_from: new Date(Date.now() - 86_400_000).toISOString(),
          p_to: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
      expect(metric(effectiveInsights, "recorded", "EUR")).toMatchObject({
        amountMinor: 73_000,
        bookingCount: 1,
      });

      const pendingAddonId = await createAddon(
        owner,
        booking.bookingId,
        "Pending at cancellation",
        3_000,
        0,
      );
      const pendingRequest = await submitAddon(owner, pendingAddonId);
      const [
        { data: amendmentEvidenceBefore },
        { data: addonEvidenceBefore },
        { data: changesBefore },
        { data: historyBefore },
      ] = await Promise.all([
        service.from("booking_amendments").select("*").eq("id", amendmentId).single(),
        service.from("booking_addons").select("*").eq("id", addonId).single(),
        service
          .from("booking_changes")
          .select("*")
          .eq("booking_id", booking.bookingId)
          .order("created_at"),
        service
          .from("booking_status_history")
          .select("*")
          .eq("booking_id", booking.bookingId)
          .order("changed_at"),
      ]);

      await transition(
        owner,
        booking.bookingId,
        "CANCELLED",
        "Customer cancelled after agreeing all scope",
      );

      const [
        { data: finalBooking },
        { data: originalConfirmationAfter },
        { data: amendmentEvidenceAfter },
        { data: addonEvidenceAfter },
        { data: pendingAddonAfter },
        { data: changesAfter },
        { data: historyAfter },
        { data: cancellationEvents },
      ] = await Promise.all([
        service
          .from("bookings")
          .select("status, total_amount_minor, deposit_amount_minor")
          .eq("id", booking.bookingId)
          .single(),
        service
          .from("booking_confirmations")
          .select("id, terms_hash, terms_snapshot, contact_email, confirmed_at")
          .eq("booking_id", booking.bookingId)
          .single(),
        service.from("booking_amendments").select("*").eq("id", amendmentId).single(),
        service.from("booking_addons").select("*").eq("id", addonId).single(),
        service
          .from("booking_addons")
          .select("status, cancellation_reason")
          .eq("id", pendingAddonId)
          .single(),
        service
          .from("booking_changes")
          .select("*")
          .eq("booking_id", booking.bookingId)
          .order("created_at"),
        service
          .from("booking_status_history")
          .select("*")
          .eq("booking_id", booking.bookingId)
          .order("changed_at"),
        service
          .from("email_events")
          .select("id, event_type, recipient_email")
          .eq("booking_id", booking.bookingId)
          .eq("event_type", "BOOKING_CANCELLED"),
      ]);

      expect(finalBooking).toEqual({
        status: "CANCELLED",
        total_amount_minor: 55_000,
        deposit_amount_minor: 20_000,
      });
      expect(originalConfirmationAfter).toEqual(originalConfirmation);
      expect(amendmentEvidenceAfter).toEqual(amendmentEvidenceBefore);
      expect(addonEvidenceAfter).toEqual(addonEvidenceBefore);
      expect(addonEvidenceAfter).toMatchObject({
        status: "CONFIRMED",
        total_amount_minor: 18_000,
      });
      expect(pendingAddonAfter).toEqual({
        status: "CANCELLED",
        cancellation_reason: "booking_cancelled",
      });
      expect(changesAfter).toEqual(changesBefore);
      for (const historicalRow of historyBefore ?? []) {
        expect(historyAfter?.find((row) => row.id === historicalRow.id)).toEqual(
          historicalRow,
        );
      }
      expect(historyAfter).toHaveLength((historyBefore?.length ?? 0) + 1);
      expect(cancellationEvents).toEqual([
        expect.objectContaining({
          event_type: "BOOKING_CANCELLED",
          recipient_email: "agreement-contact@example.com",
        }),
      ]);
      expect(
        statusOf(
          (
            await service.rpc("get_booking_addon_public_view", {
              p_token_hash: pendingRequest.tokenHash,
            })
          ).data,
        ),
      ).toBe("revoked");
    }, 90_000);

    afterAll(async () => {
      if (bookingIds.length > 0) {
        await service.from("email_events").delete().in("booking_id", bookingIds);
        await service
          .from("booking_addon_confirmation_links")
          .delete()
          .in("booking_id", bookingIds);
        await service.from("booking_addons").delete().in("booking_id", bookingIds);
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
      if (customerIds.length > 0) {
        await service.from("customers").delete().in("id", customerIds);
      }
      if (businessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("business_members").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(
        userIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    }, 30_000);
  });
} else {
  describe.skip("booking add-ons runtime", () => {
    it("requires explicit non-production runtime opt-in", () => undefined);
  });
}
