import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { generateFeedbackToken, hashFeedbackToken } from "@/features/feedback/token";
import {
  createRuntimeSecurityContext,
  expectNoRows,
} from "@/tests/security/runtime-support";

const runtime = createRuntimeSecurityContext({
  suiteName: "Phase 8",
  storagePrefix: "phase8-runtime",
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
type RpcStatus = { status?: unknown };
type UnsafeTable = {
  insert(values: Record<string, unknown>): {
    select(columns: string): {
      single(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
    };
  } & PromiseLike<{ error: unknown }>;
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ data?: unknown; error: unknown }>;
  };
  delete(): {
    eq(column: string, value: string): PromiseLike<{ error: unknown }>;
  };
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): PromiseLike<{ data: unknown[] | null; error: unknown }>;
  };
};

function statusFrom(value: unknown) {
  if (typeof value === "object" && value !== null && "status" in value) {
    return (value as RpcStatus).status;
  }

  return null;
}

if (runtimeVerificationEnabled) {
  describe("Phase 8 private feedback and issue runtime security", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase8_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdBookingIds: string[] = [];
    const createdFeedbackLinkIds: string[] = [];
    const createdFeedbackIds: string[] = [];
    const createdIssueIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase8-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase8-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 8 ${label}`,
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
      const slug = `phase8-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 8 ${label}`,
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
          name: `Phase 8 ${label}`,
          email: `${safeLabel}-${Date.now()}@example.com`,
          phone: "+353 01 555 0188",
          notes: "Runtime feedback customer",
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
          description: "Runtime feedback booking",
          currency: "NGN",
          total_amount_minor: 3_500_000,
          deposit_amount_minor: 500_000,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          internal_notes: "Private note should not leak",
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
        p_contact_email: "phase8-confirmation@example.com",
      });
      expect(error).toBeNull();
      expect(statusFrom(data)).toBe("confirmed");
      return token;
    }

    async function completeBooking(
      user: UserFixture,
      businessId: string,
      customerId: string,
      title: string,
    ) {
      const bookingId = await createBooking(
        user.client,
        businessId,
        customerId,
        user.id,
        title,
      );
      await confirmBooking(user.client, bookingId);

      for (const status of ["READY", "DELIVERED"] as const) {
        const { error } = await user.client.rpc("transition_booking_status", {
          p_booking_id: bookingId,
          p_to_status: status,
          p_cancellation_reason: null,
        });
        expect(error).toBeNull();
      }
      expect(
        (
          await user.client.rpc("record_booking_payment", {
            p_booking_id: bookingId,
            p_amount_minor: 3_000_000,
            p_operation_id: randomUUID(),
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await user.client.rpc("transition_booking_status", {
            p_booking_id: bookingId,
            p_to_status: "COMPLETED",
            p_cancellation_reason: null,
          })
        ).error,
      ).toBeNull();

      return bookingId;
    }

    async function generateFeedbackLink(client: AppClient, bookingId: string) {
      const token = generateFeedbackToken();
      const { data, error } = await client.rpc("create_booking_feedback_link", {
        p_booking_id: bookingId,
        p_token_hash: hashFeedbackToken(token),
        p_expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      });
      expect(error).toBeNull();
      expect(data?.[0]?.feedback_link_id).toBeTruthy();
      createdFeedbackLinkIds.push(data![0].feedback_link_id);
      return { token, linkId: data![0].feedback_link_id };
    }

    async function submitFeedback(token: string, rating = 5) {
      const { data, error } = await service.rpc("submit_feedback_by_token_hash", {
        p_token_hash: hashFeedbackToken(token),
        p_overall_rating: rating,
        p_on_time: true,
        p_met_expectations: true,
        p_comment: "Private runtime feedback",
      });
      expect(error).toBeNull();
      return data;
    }

    it("enforces feedback capability security and issue isolation", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");
      const customerAId = await createCustomer(userA.client, businessAId, "Customer A");
      const customerBId = await createCustomer(userB.client, businessBId, "Customer B");

      const completedA = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Completed A",
      );
      const completedB = await completeBooking(
        userB,
        businessBId,
        customerBId,
        "Phase 8 Completed B",
      );

      const feedbackA = await generateFeedbackLink(userA.client, completedA);
      const { data: validView, error: validViewError } = await service.rpc(
        "get_feedback_public_view",
        { p_token_hash: hashFeedbackToken(feedbackA.token) },
      );
      expect(validViewError).toBeNull();
      expect(statusFrom(validView)).toBe("valid");
      expect(JSON.stringify(validView)).toContain("booking_reference");
      expect(JSON.stringify(validView)).not.toContain("internal_notes");
      expect(JSON.stringify(validView)).not.toContain("total_amount_minor");
      expect(JSON.stringify(validView)).not.toContain("business_id");
      expect(JSON.stringify(validView)).not.toContain(hashFeedbackToken(feedbackA.token));

      const feedbackTokenHash = hashFeedbackToken(feedbackA.token);
      const firstOpen = await service.rpc("record_feedback_link_open", {
        p_token_hash: feedbackTokenHash,
      });
      const repeatedOpen = await service.rpc("record_feedback_link_open", {
        p_token_hash: feedbackTokenHash,
      });
      expect(firstOpen.error).toBeNull();
      expect(firstOpen.data).toBe(true);
      expect(repeatedOpen.error).toBeNull();
      expect(repeatedOpen.data).toBe(false);

      const { data: openedLink } = await service
        .from("feedback_links")
        .select("first_opened_at")
        .eq("id", feedbackA.linkId)
        .single();
      expect(openedLink?.first_opened_at).toBeTruthy();

      const { count: openAuditCount } = await service
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessAId)
        .eq("event_type", "FEEDBACK_OPENED")
        .contains("metadata", { feedback_link_id: feedbackA.linkId });
      expect(openAuditCount).toBe(1);

      expect(
        (
          await userA.client.rpc("record_feedback_link_open", {
            p_token_hash: feedbackTokenHash,
          })
        ).error,
      ).not.toBeNull();
      const anonOpenClient = createSupabaseClient(publishableKey);
      expect(
        (
          await anonOpenClient.rpc("record_feedback_link_open", {
            p_token_hash: feedbackTokenHash,
          })
        ).error,
      ).not.toBeNull();

      const submitResult = await submitFeedback(feedbackA.token);
      expect(statusFrom(submitResult)).toBe("submitted");

      const { data: storedFeedback, error: storedFeedbackError } = await service
        .from("feedback")
        .select("*")
        .eq("booking_id", completedA)
        .single();
      expect(storedFeedbackError).toBeNull();
      expect(storedFeedback?.overall_rating).toBe(5);
      expect(storedFeedback?.comment).toBe("Private runtime feedback");
      createdFeedbackIds.push(storedFeedback!.id);

      const repeatResult = await submitFeedback(feedbackA.token, 4);
      expect(statusFrom(repeatResult)).toBe("already_submitted");
      const { count: duplicateCount } = await service
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", completedA);
      expect(duplicateCount).toBe(1);

      expect(
        (
          await userA.client.rpc("create_booking_feedback_link", {
            p_booking_id: completedA,
            p_token_hash: hashFeedbackToken(generateFeedbackToken()),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).not.toBeNull();

      const randomToken = generateFeedbackToken();
      const { data: invalidTokenView } = await service.rpc("get_feedback_public_view", {
        p_token_hash: hashFeedbackToken(randomToken),
      });
      expect(statusFrom(invalidTokenView)).toBe("unavailable");

      const expiredBooking = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Expired Link",
      );
      const expired = await generateFeedbackLink(userA.client, expiredBooking);
      const expiredCreatedAt = new Date(Date.now() - 120_000).toISOString();
      const expiredExpiresAt = new Date(Date.now() - 60_000).toISOString();
      const expiredUpdate = await (
        service.from("feedback_links") as unknown as UnsafeTable
      )
        .update({ created_at: expiredCreatedAt, expires_at: expiredExpiresAt })
        .eq("id", expired.linkId);
      expect(expiredUpdate.error).toBeNull();
      const { data: expiredResult } = await service.rpc("submit_feedback_by_token_hash", {
        p_token_hash: hashFeedbackToken(expired.token),
        p_overall_rating: 5,
        p_on_time: true,
        p_met_expectations: true,
        p_comment: null,
      });
      expect(statusFrom(expiredResult)).toBe("expired");

      const revokedBooking = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Revoked Link",
      );
      const revoked = await generateFeedbackLink(userA.client, revokedBooking);
      expect(
        (
          await userA.client.rpc("revoke_booking_feedback_link", {
            p_booking_id: revokedBooking,
          })
        ).error,
      ).toBeNull();
      const { data: revokedResult } = await service.rpc("submit_feedback_by_token_hash", {
        p_token_hash: hashFeedbackToken(revoked.token),
        p_overall_rating: 5,
        p_on_time: true,
        p_met_expectations: true,
        p_comment: null,
      });
      expect(statusFrom(revokedResult)).toBe("revoked");

      const purposeBooking = await createBooking(
        userA.client,
        businessAId,
        customerAId,
        userA.id,
        "Phase 8 Purpose Boundary",
      );
      const confirmationToken = await confirmBooking(userA.client, purposeBooking);
      const { data: wrongPurposeFeedback } = await service.rpc(
        "get_feedback_public_view",
        {
          p_token_hash: hashConfirmationToken(confirmationToken),
        },
      );
      expect(statusFrom(wrongPurposeFeedback)).toBe("unavailable");
      const completedPurpose = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Feedback Purpose Boundary",
      );
      const feedbackPurpose = await generateFeedbackLink(userA.client, completedPurpose);
      const { data: wrongPurposeConfirmation } = await service.rpc(
        "confirm_booking_by_token_hash",
        {
          p_token_hash: hashFeedbackToken(feedbackPurpose.token),
          p_contact_email: "phase8-wrong-purpose@example.com",
        },
      );
      expect(statusFrom(wrongPurposeConfirmation)).toBe("unavailable");

      for (const status of [
        "DRAFT",
        "CONFIRMED",
        "IN_PROGRESS",
        "READY",
        "DELIVERED",
        "CANCELLED",
      ] as const) {
        const bookingId = await createBooking(
          userA.client,
          businessAId,
          customerAId,
          userA.id,
          `Phase 8 Non Completed ${status}`,
        );
        if (status !== "DRAFT") {
          await confirmBooking(userA.client, bookingId);
        }
        if (status === "IN_PROGRESS" || status === "READY" || status === "DELIVERED") {
          for (const nextStatus of ["IN_PROGRESS", "READY", "DELIVERED"] as const) {
            const { data: current } = await service
              .from("bookings")
              .select("status")
              .eq("id", bookingId)
              .single();
            if (current?.status === nextStatus) {
              break;
            }
            expect(
              (
                await userA.client.rpc("transition_booking_status", {
                  p_booking_id: bookingId,
                  p_to_status: nextStatus,
                  p_cancellation_reason: null,
                })
              ).error,
            ).toBeNull();
          }
        }
        if (status === "CANCELLED") {
          expect(
            (
              await userA.client.rpc("transition_booking_status", {
                p_booking_id: bookingId,
                p_to_status: "CANCELLED",
                p_cancellation_reason: "Cancelled before feedback",
              })
            ).error,
          ).toBeNull();
        }
        expect(
          (
            await userA.client.rpc("create_booking_feedback_link", {
              p_booking_id: bookingId,
              p_token_hash: hashFeedbackToken(generateFeedbackToken()),
              p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
            })
          ).error,
        ).not.toBeNull();
      }

      expect(
        (
          await userB.client.rpc("create_booking_feedback_link", {
            p_booking_id: completedA,
            p_token_hash: hashFeedbackToken(generateFeedbackToken()),
            p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await userB.client.rpc("revoke_booking_feedback_link", {
            p_booking_id: completedA,
          })
        ).error,
      ).not.toBeNull();

      const { data: userAFeedback } = await userA.client
        .from("feedback")
        .select("id")
        .eq("id", storedFeedback!.id);
      expect(userAFeedback).toHaveLength(1);
      const { data: userBFeedback } = await userB.client
        .from("feedback")
        .select("id")
        .eq("id", storedFeedback!.id);
      expectNoRows(userBFeedback);
      const anon = createSupabaseClient(publishableKey);
      expect(
        (await anon.from("feedback").select("id").eq("id", storedFeedback!.id)).error,
      ).not.toBeNull();

      const unsafeFeedback = userA.client.from("feedback") as unknown as UnsafeTable;
      expect(
        (await unsafeFeedback.update({ overall_rating: 1 }).eq("id", storedFeedback!.id))
          .error,
      ).not.toBeNull();
      expect(
        (await unsafeFeedback.delete().eq("id", storedFeedback!.id)).error,
      ).not.toBeNull();

      const raceBooking = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Race Booking",
      );
      const race = await generateFeedbackLink(userA.client, raceBooking);
      const [raceA, raceB] = await Promise.all([
        service.rpc("submit_feedback_by_token_hash", {
          p_token_hash: hashFeedbackToken(race.token),
          p_overall_rating: 5,
          p_on_time: true,
          p_met_expectations: true,
          p_comment: "First concurrent feedback",
        }),
        service.rpc("submit_feedback_by_token_hash", {
          p_token_hash: hashFeedbackToken(race.token),
          p_overall_rating: 4,
          p_on_time: false,
          p_met_expectations: true,
          p_comment: "Second concurrent feedback",
        }),
      ]);
      expect(raceA.error).toBeNull();
      expect(raceB.error).toBeNull();
      expect([statusFrom(raceA.data), statusFrom(raceB.data)].sort()).toEqual([
        "already_submitted",
        "submitted",
      ]);
      const { count: raceCount } = await service
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", raceBooking);
      expect(raceCount).toBe(1);

      const integrityBooking = await completeBooking(
        userA,
        businessAId,
        customerAId,
        "Phase 8 Integrity Booking",
      );
      const integrityLink = await generateFeedbackLink(userA.client, integrityBooking);
      for (const invalidRating of [0, 6]) {
        const { data: invalidRatingResult, error: invalidRatingError } =
          await service.rpc("submit_feedback_by_token_hash", {
            p_token_hash: hashFeedbackToken(integrityLink.token),
            p_overall_rating: invalidRating,
            p_on_time: true,
            p_met_expectations: true,
            p_comment: null,
          });
        expect(invalidRatingError).toBeNull();
        expect(statusFrom(invalidRatingResult)).toBe("invalid_feedback");
      }
      expect(
        (
          await service.from("feedback").insert({
            business_id: businessAId,
            booking_id: integrityBooking,
            customer_id: customerBId,
            feedback_link_id: integrityLink.linkId,
            overall_rating: 5,
            on_time: true,
            met_expectations: true,
          })
        ).error,
      ).not.toBeNull();

      const { data: issueA, error: issueAError } = await userA.client
        .from("booking_issues")
        .insert({
          business_id: businessAId,
          booking_id: completedA,
          category: "LATE_DELIVERY",
          description: "Delivery was late.",
          created_by: userB.id,
          created_at: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .select("id, created_by, status, resolved_at")
        .single();
      expect(issueAError).toBeNull();
      expect(issueA?.created_by).toBe(userA.id);
      expect(issueA?.status).toBe("OPEN");
      expect(issueA?.resolved_at).toBeNull();
      createdIssueIds.push(issueA!.id);

      const { data: issueB, error: issueBError } = await userB.client
        .from("booking_issues")
        .insert({
          business_id: businessBId,
          booking_id: completedB,
          category: "NO_SHOW",
          description: "Customer did not arrive.",
          created_by: userB.id,
        })
        .select("id")
        .single();
      expect(issueBError).toBeNull();
      createdIssueIds.push(issueB!.id);

      expect(
        (await userA.client.from("booking_issues").select("id").eq("id", issueA!.id))
          .data,
      ).toHaveLength(1);
      expectNoRows(
        (await userA.client.from("booking_issues").select("id").eq("id", issueB!.id))
          .data,
      );
      expectNoRows(
        (await userB.client.from("booking_issues").select("id").eq("id", issueA!.id))
          .data,
      );
      expect(
        (await anon.from("booking_issues").select("id").eq("id", issueA!.id)).error,
      ).not.toBeNull();
      const crossTenantResolve = await userA.client
        .from("booking_issues")
        .update({ status: "RESOLVED" })
        .eq("id", issueB!.id)
        .select("id");
      expect(crossTenantResolve.error).toBeNull();
      expectNoRows(crossTenantResolve.data);
      const { data: issueBAfterCrossTenantAttempt } = await service
        .from("booking_issues")
        .select("status")
        .eq("id", issueB!.id)
        .single();
      expect(issueBAfterCrossTenantAttempt?.status).toBe("OPEN");

      const [resolveA, resolveB] = await Promise.all([
        userA.client
          .from("booking_issues")
          .update({
            status: "RESOLVED",
            resolved_by: userB.id,
            resolved_at: new Date(Date.now() - 86_400_000).toISOString(),
          })
          .eq("id", issueA!.id)
          .select("id, status, resolved_by, resolved_at")
          .maybeSingle(),
        userA.client
          .from("booking_issues")
          .update({ status: "RESOLVED" })
          .eq("id", issueA!.id)
          .select("id")
          .maybeSingle(),
      ]);
      const successfulResolution = [resolveA, resolveB].find(
        (result) => !result.error && result.data,
      );
      const failedResolution = [resolveA, resolveB].find(
        (result) => result.error || !result.data,
      );
      expect(successfulResolution?.data).toBeTruthy();
      expect(failedResolution).toBeTruthy();

      const { data: resolvedIssue } = await service
        .from("booking_issues")
        .select("status, resolved_by, resolved_at")
        .eq("id", issueA!.id)
        .single();
      expect(resolvedIssue?.status).toBe("RESOLVED");
      expect(resolvedIssue?.resolved_by).toBe(userA.id);
      expect(resolvedIssue?.resolved_at).toBeTruthy();

      expect(
        (
          await userA.client
            .from("booking_issues")
            .update({ status: "RESOLVED" })
            .eq("id", issueA!.id)
        ).error,
      ).not.toBeNull();

      const unsafeIssue = service.from("booking_issues") as unknown as UnsafeTable;
      expect(
        (
          await unsafeIssue.insert({
            business_id: businessAId,
            booking_id: completedA,
            category: "NOT_REAL",
            description: "Invalid category",
            created_by: userA.id,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await unsafeIssue.insert({
            business_id: businessAId,
            booking_id: completedA,
            category: "OTHER",
            description: "Invalid status",
            status: "BROKEN",
            created_by: userA.id,
          })
        ).error,
      ).not.toBeNull();

      const { data: auditRows, error: auditError } = await service
        .from("audit_logs")
        .select("event_type, metadata")
        .eq("business_id", businessAId);
      expect(auditError).toBeNull();
      const eventTypes = auditRows?.map((row) => row.event_type) ?? [];
      expect(eventTypes).toContain("FEEDBACK_LINK_CREATED");
      expect(eventTypes).toContain("FEEDBACK_LINK_REVOKED");
      expect(eventTypes).toContain("FEEDBACK_OPENED");
      expect(eventTypes).toContain("FEEDBACK_SUBMITTED");
      expect(JSON.stringify(auditRows)).not.toContain("Private runtime feedback");
      expect(JSON.stringify(auditRows)).not.toContain(feedbackA.token);
    }, 300_000);

    afterAll(async () => {
      if (createdIssueIds.length > 0) {
        await service.from("booking_issues").delete().in("id", createdIssueIds);
      }

      if (createdBookingIds.length > 0) {
        await service.from("feedback").delete().in("booking_id", createdBookingIds);
        await service.from("feedback_links").delete().in("booking_id", createdBookingIds);
        await service
          .from("booking_confirmations")
          .delete()
          .in("booking_id", createdBookingIds);
        await service
          .from("confirmation_links")
          .delete()
          .in("booking_id", createdBookingIds);
        await service
          .from("booking_status_history")
          .delete()
          .in("booking_id", createdBookingIds);
        await service
          .from("booking_changes")
          .delete()
          .in("booking_id", createdBookingIds);
        await service.from("bookings").delete().in("id", createdBookingIds);
      }

      if (createdFeedbackIds.length > 0) {
        await service.from("feedback").delete().in("id", createdFeedbackIds);
      }

      if (createdFeedbackLinkIds.length > 0) {
        await service.from("feedback_links").delete().in("id", createdFeedbackLinkIds);
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
  describe.skip("Phase 8 private feedback and issue runtime security", () => {
    it("is skipped until explicitly pointed at a safe Supabase dev/test target", () => {
      expect(runtimeVerificationEnabled).toBe(false);
    });
  });
}
