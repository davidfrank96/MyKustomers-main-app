import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import { hashFeedbackToken } from "@/features/feedback/token";

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
type AnalyticsJson = {
  customers: {
    totalActive: number;
    new: number;
    returning: number;
    periodQualifying: number;
    repeatRate: number | null;
  };
  bookings: {
    created: number;
    completed: number;
    cancelled: number;
    active: number;
  };
  value: {
    recorded: { currency: string; amountMinor: number; bookingCount: number }[];
    completed: { currency: string; amountMinor: number; bookingCount: number }[];
    average: { currency: string; amountMinor: number; bookingCount: number }[];
    deposits: { currency: string; amountMinor: number; bookingCount: number }[];
  };
  operations: {
    onTimeEligible: number;
    onTimeCount: number;
    onTimeRate: number | null;
    overdue: number;
    cancellationEligible: number;
    cancellationRate: number | null;
    averageFulfillmentMinutes: number | null;
  };
  feedback: {
    responses: number;
    averageRating: number | null;
    onTimeYes: number;
    onTimePercentage: number | null;
    metExpectationsYes: number;
    metExpectationsPercentage: number | null;
  };
  issues: {
    opened: number;
    resolved: number;
    resolutionRate: number | null;
    categories: { category: string; count: number }[];
  };
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Phase 9 runtime verification.`);
  }

  return value;
}

function createSupabaseClient(key: string) {
  return createClient<Database>(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `phase9-runtime-${randomUUID()}`,
    },
  });
}

function asAnalyticsJson(value: unknown) {
  return value as AnalyticsJson;
}

function valueMap(rows: { currency: string; amountMinor: number; bookingCount: number }[]) {
  return new Map(rows.map((row) => [row.currency, row]));
}

if (runtimeVerificationEnabled) {
  describe("Phase 9 analytics runtime security and correctness", () => {
    const service = createSupabaseClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixtureId = `phase9_${Date.now()}_${randomUUID()}`;
    const createdUserIds: string[] = [];
    const createdBusinessIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdBookingIds: string[] = [];
    const createdFeedbackLinkIds: string[] = [];
    const createdFeedbackIds: string[] = [];
    const createdIssueIds: string[] = [];

    async function createConfirmedUser(label: string): Promise<UserFixture> {
      const email = `phase9-${label}-${fixtureId}@example.com`.toLowerCase();
      const password = `Phase9-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: `Phase 9 ${label}`,
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
      const slug = `phase9-${safeLabel}-${randomUUID().slice(0, 8)}`;
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Phase 9 ${label}`,
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

    async function createCustomer(businessId: string, label: string, archived = false) {
      const { data, error } = await service
        .from("customers")
        .insert({
          business_id: businessId,
          name: `Phase 9 ${label}`,
          email: `phase9-${label}-${randomUUID()}@example.com`.toLowerCase(),
          phone: "+353 01 555 0199",
          notes: "Runtime analytics customer",
          archived_at: archived ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdCustomerIds.push(data!.id);
      return data!.id;
    }

    async function createBooking({
      businessId,
      customerId,
      creatorId,
      title,
      currency,
      total,
      deposit,
      status,
      createdAt,
      scheduledFor,
      startedAt,
      readyAt,
      deliveredAt,
      completedAt,
      cancelledAt,
    }: {
      businessId: string;
      customerId: string;
      creatorId: string;
      title: string;
      currency: "NGN" | "EUR" | "GBP" | "USD";
      total: number;
      deposit: number;
      status: Database["public"]["Enums"]["booking_status"];
      createdAt: string;
      scheduledFor?: string | null;
      startedAt?: string | null;
      readyAt?: string | null;
      deliveredAt?: string | null;
      completedAt?: string | null;
      cancelledAt?: string | null;
    }) {
      const { data, error } = await service
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title,
          description: "Runtime analytics booking",
          currency,
          total_amount_minor: total,
          deposit_amount_minor: deposit,
          status,
          scheduled_for: scheduledFor ?? null,
          started_at: startedAt ?? null,
          ready_at: readyAt ?? null,
          delivered_at: deliveredAt ?? null,
          completed_at: completedAt ?? null,
          cancelled_at: cancelledAt ?? null,
          internal_notes: "Private analytics note",
          created_by: creatorId,
          created_at: createdAt,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdBookingIds.push(data!.id);
      return data!.id;
    }

    async function createFeedback({
      businessId,
      bookingId,
      customerId,
      creatorId,
      rating,
      onTime,
      metExpectations,
    }: {
      businessId: string;
      bookingId: string;
      customerId: string;
      creatorId: string;
      rating: number;
      onTime: boolean;
      metExpectations: boolean;
    }) {
      const { data: link, error: linkError } = await service
        .from("feedback_links")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          token_hash: hashFeedbackToken(`phase9-${randomUUID()}`),
          expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          created_by: creatorId,
        })
        .select("id")
        .single();

      expect(linkError).toBeNull();
      expect(link?.id).toBeTruthy();
      createdFeedbackLinkIds.push(link!.id);

      const { data, error } = await service
        .from("feedback")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          customer_id: customerId,
          feedback_link_id: link!.id,
          overall_rating: rating,
          on_time: onTime,
          met_expectations: metExpectations,
          comment: "Private analytics feedback",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdFeedbackIds.push(data!.id);
    }

    async function createIssue(
      client: AppClient,
      businessId: string,
      bookingId: string,
      creatorId: string,
      category: Database["public"]["Enums"]["booking_issue_category"],
      resolve = false,
    ) {
      const { data, error } = await client
        .from("booking_issues")
        .insert({
          business_id: businessId,
          booking_id: bookingId,
          category,
          description: `Phase 9 ${category}`,
          created_by: creatorId,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      createdIssueIds.push(data!.id);

      if (resolve) {
        const { data: resolved, error: resolveError } = await client
          .from("booking_issues")
          .update({ status: "RESOLVED" })
          .eq("id", data!.id)
          .select("id")
          .single();

        expect(resolveError).toBeNull();
        expect(resolved?.id).toBe(data!.id);
      }
    }

    it("returns exact tenant-scoped analytics and denies aggregate leakage", async () => {
      const userA = await createConfirmedUser("owner-a");
      const userB = await createConfirmedUser("owner-b");
      const businessAId = await createBusiness(userA.id, "Business A");
      const businessBId = await createBusiness(userB.id, "Business B");

      const customerA1 = await createCustomer(businessAId, "A1");
      const customerA2 = await createCustomer(businessAId, "A2");
      const customerA3 = await createCustomer(businessAId, "A3");
      const customerB = await createCustomer(businessBId, "B1");

      const booking1 = await createBooking({
        businessId: businessAId,
        customerId: customerA1,
        creatorId: userA.id,
        title: "A1 completed on time",
        currency: "NGN",
        total: 100_000,
        deposit: 10_000,
        status: "COMPLETED",
        createdAt: "2026-08-01T09:00:00.000Z",
        scheduledFor: "2026-08-10T10:00:00.000Z",
        startedAt: "2026-08-10T08:00:00.000Z",
        readyAt: "2026-08-10T08:30:00.000Z",
        deliveredAt: "2026-08-10T09:00:00.000Z",
        completedAt: "2026-08-10T10:00:00.000Z",
      });
      const booking2 = await createBooking({
        businessId: businessAId,
        customerId: customerA1,
        creatorId: userA.id,
        title: "A1 completed late",
        currency: "NGN",
        total: 200_000,
        deposit: 20_000,
        status: "COMPLETED",
        createdAt: "2026-08-02T09:00:00.000Z",
        scheduledFor: "2026-08-12T10:00:00.000Z",
        startedAt: "2026-08-12T08:00:00.000Z",
        readyAt: "2026-08-12T09:00:00.000Z",
        deliveredAt: "2026-08-12T12:00:00.000Z",
        completedAt: "2026-08-12T12:00:00.000Z",
      });
      const booking3 = await createBooking({
        businessId: businessAId,
        customerId: customerA2,
        creatorId: userA.id,
        title: "A2 completed EUR",
        currency: "EUR",
        total: 85_000,
        deposit: 0,
        status: "COMPLETED",
        createdAt: "2026-08-03T09:00:00.000Z",
        scheduledFor: "2026-08-13T10:00:00.000Z",
        startedAt: "2026-08-13T09:00:00.000Z",
        readyAt: "2026-08-13T09:15:00.000Z",
        deliveredAt: "2026-08-13T09:30:00.000Z",
        completedAt: "2026-08-13T10:00:00.000Z",
      });
      const cancelled = await createBooking({
        businessId: businessAId,
        customerId: customerA3,
        creatorId: userA.id,
        title: "A3 cancelled high value",
        currency: "USD",
        total: 999_999,
        deposit: 0,
        status: "CANCELLED",
        createdAt: "2026-08-04T09:00:00.000Z",
        scheduledFor: "2026-08-15T10:00:00.000Z",
        cancelledAt: "2026-08-04T10:00:00.000Z",
      });
      expect(cancelled).toBeTruthy();
      const active = await createBooking({
        businessId: businessAId,
        customerId: customerA2,
        creatorId: userA.id,
        title: "A2 active overdue USD",
        currency: "USD",
        total: 5_000,
        deposit: 500,
        status: "IN_PROGRESS",
        createdAt: "2026-08-05T09:00:00.000Z",
        scheduledFor: "2026-08-06T10:00:00.000Z",
        startedAt: "2026-08-06T08:00:00.000Z",
      });
      expect(active).toBeTruthy();
      await createBooking({
        businessId: businessAId,
        customerId: customerA3,
        creatorId: userA.id,
        title: "A3 draft should not inflate value",
        currency: "GBP",
        total: 777_777,
        deposit: 0,
        status: "DRAFT",
        createdAt: "2026-08-06T09:00:00.000Z",
      });
      await createBooking({
        businessId: businessBId,
        customerId: customerB,
        creatorId: userB.id,
        title: "Business B should never leak",
        currency: "GBP",
        total: 9_999_999,
        deposit: 0,
        status: "COMPLETED",
        createdAt: "2026-08-01T09:00:00.000Z",
        scheduledFor: "2026-08-10T10:00:00.000Z",
        startedAt: "2026-08-10T08:00:00.000Z",
        readyAt: "2026-08-10T08:30:00.000Z",
        deliveredAt: "2026-08-10T09:00:00.000Z",
        completedAt: "2026-08-10T10:00:00.000Z",
      });

      await createFeedback({
        businessId: businessAId,
        bookingId: booking1,
        customerId: customerA1,
        creatorId: userA.id,
        rating: 5,
        onTime: true,
        metExpectations: true,
      });
      await createFeedback({
        businessId: businessAId,
        bookingId: booking2,
        customerId: customerA1,
        creatorId: userA.id,
        rating: 4,
        onTime: false,
        metExpectations: true,
      });
      await createFeedback({
        businessId: businessAId,
        bookingId: booking3,
        customerId: customerA2,
        creatorId: userA.id,
        rating: 3,
        onTime: true,
        metExpectations: false,
      });

      await createIssue(userA.client, businessAId, booking1, userA.id, "LATE_DELIVERY", true);
      await createIssue(userA.client, businessAId, booking2, userA.id, "LATE_DELIVERY");
      await createIssue(userA.client, businessAId, booking3, userA.id, "COMMUNICATION_ISSUE");

      const { data, error } = await userA.client.rpc("get_business_insights", {
        p_business_id: businessAId,
        p_from: "2026-08-01T00:00:00.000Z",
        p_to: "2026-09-01T00:00:00.000Z",
      });

      expect(error).toBeNull();
      const analytics = asAnalyticsJson(data);

      expect(analytics.customers.totalActive).toBe(3);
      expect(analytics.customers.new).toBe(2);
      expect(analytics.customers.returning).toBe(2);
      expect(analytics.customers.periodQualifying).toBe(2);
      expect(analytics.customers.repeatRate).toBe(1);

      expect(analytics.bookings).toEqual({
        created: 6,
        completed: 3,
        cancelled: 1,
        active: 2,
      });

      const recorded = valueMap(analytics.value.recorded);
      expect(recorded.get("NGN")).toMatchObject({ amountMinor: 300_000, bookingCount: 2 });
      expect(recorded.get("EUR")).toMatchObject({ amountMinor: 85_000, bookingCount: 1 });
      expect(recorded.get("USD")).toMatchObject({ amountMinor: 5_000, bookingCount: 1 });
      expect(recorded.has("GBP")).toBe(false);

      const completedValue = valueMap(analytics.value.completed);
      expect(completedValue.get("NGN")).toMatchObject({ amountMinor: 300_000, bookingCount: 2 });
      expect(completedValue.get("EUR")).toMatchObject({ amountMinor: 85_000, bookingCount: 1 });
      expect(completedValue.has("USD")).toBe(false);
      expect(completedValue.has("GBP")).toBe(false);

      const average = valueMap(analytics.value.average);
      expect(average.get("NGN")).toMatchObject({ amountMinor: 150_000, bookingCount: 2 });
      expect(average.get("EUR")).toMatchObject({ amountMinor: 85_000, bookingCount: 1 });
      expect(average.get("USD")).toMatchObject({ amountMinor: 5_000, bookingCount: 1 });

      const deposits = valueMap(analytics.value.deposits);
      expect(deposits.get("NGN")).toMatchObject({ amountMinor: 30_000, bookingCount: 2 });
      expect(deposits.get("USD")).toMatchObject({ amountMinor: 500, bookingCount: 1 });

      expect(analytics.operations.onTimeEligible).toBe(3);
      expect(analytics.operations.onTimeCount).toBe(2);
      expect(analytics.operations.onTimeRate).toBeCloseTo(2 / 3);
      expect(analytics.operations.overdue).toBeGreaterThanOrEqual(1);
      expect(analytics.operations.cancellationEligible).toBe(4);
      expect(analytics.operations.cancellationRate).toBe(0.25);
      expect(analytics.operations.averageFulfillmentMinutes).toBe(140);

      expect(analytics.feedback.responses).toBe(3);
      expect(analytics.feedback.averageRating).toBe(4);
      expect(analytics.feedback.onTimePercentage).toBeCloseTo(2 / 3);
      expect(analytics.feedback.metExpectationsPercentage).toBeCloseTo(2 / 3);

      expect(analytics.issues.opened).toBe(3);
      expect(analytics.issues.resolved).toBe(1);
      expect(analytics.issues.resolutionRate).toBeCloseTo(1 / 3);
      expect(analytics.issues.categories).toEqual([
        { category: "LATE_DELIVERY", count: 2 },
        { category: "COMMUNICATION_ISSUE", count: 1 },
      ]);

      const { data: crossTenantData, error: crossTenantError } =
        await userA.client.rpc("get_business_insights", {
          p_business_id: businessBId,
          p_from: "2026-08-01T00:00:00.000Z",
          p_to: "2026-09-01T00:00:00.000Z",
        });
      expect(crossTenantData).toBeNull();
      expect(crossTenantError).not.toBeNull();

      const { data: userBData, error: userBError } = await userB.client.rpc(
        "get_business_insights",
        {
          p_business_id: businessBId,
          p_from: "2026-08-01T00:00:00.000Z",
          p_to: "2026-09-01T00:00:00.000Z",
        },
      );
      expect(userBError).toBeNull();
      const businessBAnalytics = asAnalyticsJson(userBData);
      expect(businessBAnalytics.bookings.completed).toBe(1);
      expect(valueMap(businessBAnalytics.value.completed).get("GBP")).toMatchObject({
        amountMinor: 9_999_999,
      });
    }, 30_000);

    afterAll(async () => {
      if (createdIssueIds.length > 0) {
        await service.from("booking_issues").delete().in("id", createdIssueIds);
      }
      if (createdFeedbackIds.length > 0) {
        await service.from("feedback").delete().in("id", createdFeedbackIds);
      }
      if (createdFeedbackLinkIds.length > 0) {
        await service.from("feedback_links").delete().in("id", createdFeedbackLinkIds);
      }
      if (createdBookingIds.length > 0) {
        await service.from("booking_status_history").delete().in("booking_id", createdBookingIds);
        await service.from("booking_changes").delete().in("booking_id", createdBookingIds);
        await service.from("bookings").delete().in("id", createdBookingIds);
      }
      if (createdCustomerIds.length > 0) {
        await service.from("customers").delete().in("id", createdCustomerIds);
      }
      if (createdBusinessIds.length > 0) {
        await service.from("audit_logs").delete().in("business_id", createdBusinessIds);
        await service.from("business_members").delete().in("business_id", createdBusinessIds);
        await service.from("businesses").delete().in("id", createdBusinessIds);
      }

      await Promise.allSettled(
        createdUserIds.map((userId) => service.auth.admin.deleteUser(userId)),
      );
    });
  });
} else {
  describe.skip("Phase 9 analytics runtime security and correctness", () => {
    it("requires explicit runtime verification configuration", () => {
      expect(runtimeVerificationEnabled).toBe(true);
    });
  });
}
