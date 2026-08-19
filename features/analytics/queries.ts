import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { bookingCurrencies } from "@/features/bookings/money";
import { issueCategories } from "@/features/feedback/validation";
import { compareNumbers } from "@/features/analytics/format";
import type {
  AnalyticsDateRange,
  AnalyticsPayload,
  BusinessInsights,
  CurrencyMetric,
  PeriodComparison,
} from "@/features/analytics/types";

const currencyMetricSchema = z.object({
  currency: z.enum(bookingCurrencies),
  amountMinor: z.number(),
  bookingCount: z.number().int().nonnegative(),
});

const analyticsPayloadSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    bucket: z.enum(["day", "month"]),
  }),
  customers: z.object({
    totalActive: z.number().int().nonnegative(),
    new: z.number().int().nonnegative(),
    returning: z.number().int().nonnegative(),
    periodQualifying: z.number().int().nonnegative(),
    repeatRate: z.number().nullable(),
  }),
  bookings: z.object({
    created: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
  }),
  value: z.object({
    recorded: z.array(currencyMetricSchema),
    completed: z.array(currencyMetricSchema),
    average: z.array(currencyMetricSchema),
    deposits: z.array(currencyMetricSchema),
  }),
  operations: z.object({
    onTimeEligible: z.number().int().nonnegative(),
    onTimeCount: z.number().int().nonnegative(),
    onTimeRate: z.number().nullable(),
    overdue: z.number().int().nonnegative(),
    cancellationEligible: z.number().int().nonnegative(),
    cancellationRate: z.number().nullable(),
    averageFulfillmentMinutes: z.number().int().nonnegative().nullable(),
  }),
  feedback: z.object({
    responses: z.number().int().nonnegative(),
    averageRating: z.number().nullable(),
    onTimeYes: z.number().int().nonnegative(),
    onTimePercentage: z.number().nullable(),
    metExpectationsYes: z.number().int().nonnegative(),
    metExpectationsPercentage: z.number().nullable(),
  }),
  issues: z.object({
    opened: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    resolutionRate: z.number().nullable(),
    categories: z.array(
      z.object({
        category: z.enum(issueCategories),
        count: z.number().int().nonnegative(),
      }),
    ),
  }),
  trends: z.object({
    bookings: z.array(
      z.object({
        periodStart: z.string(),
        created: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
      }),
    ),
    completedValue: z.array(
      z.object({
        periodStart: z.string(),
        currency: z.enum(bookingCurrencies),
        amountMinor: z.number(),
      }),
    ),
    feedbackRating: z.array(
      z.object({
        periodStart: z.string(),
        averageRating: z.number(),
        responses: z.number().int().nonnegative(),
      }),
    ),
  }),
}) satisfies z.ZodType<AnalyticsPayload>;

function noPreviousActivity(): PeriodComparison {
  return { kind: "none", label: "No previous activity" };
}

function countMetric(current: number, previous: number) {
  return {
    value: current,
    comparison: compareNumbers(current, previous),
  };
}

function nullableCountMetric(current: number | null, previous: number | null) {
  return {
    value: current ?? 0,
    comparison:
      current === null && previous === null ? noPreviousActivity() : compareNumbers(current, previous),
  };
}

function rateMetric({
  currentRate,
  previousRate,
  numerator,
  denominator,
}: {
  currentRate: number | null;
  previousRate: number | null;
  numerator: number;
  denominator: number;
}) {
  return {
    value: currentRate,
    numerator,
    denominator,
    comparison:
      currentRate === null && previousRate === null
        ? noPreviousActivity()
        : compareNumbers(currentRate, previousRate),
  };
}

function metricMap(rows: Omit<CurrencyMetric, "comparison">[]) {
  return new Map(rows.map((row) => [row.currency, row]));
}

function currencyMetrics(
  currentRows: Omit<CurrencyMetric, "comparison">[],
  previousRows: Omit<CurrencyMetric, "comparison">[],
) {
  const currentMap = metricMap(currentRows);
  const previousMap = metricMap(previousRows);
  const currencies = [...new Set([...currentMap.keys(), ...previousMap.keys()])].sort();

  return currencies.map((currency) => {
    const current = currentMap.get(currency);
    const previous = previousMap.get(currency);

    return {
      currency,
      amountMinor: current?.amountMinor ?? 0,
      bookingCount: current?.bookingCount ?? 0,
      comparison: compareNumbers(current?.amountMinor ?? 0, previous?.amountMinor ?? 0),
    };
  }) satisfies CurrencyMetric[];
}

async function fetchAnalyticsPayload(
  businessId: string,
  from: Date,
  to: Date,
): Promise<AnalyticsPayload> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_business_insights", {
    p_business_id: businessId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) {
    throw new Error("Business insights could not be loaded.");
  }

  return analyticsPayloadSchema.parse(data);
}

export async function getBusinessInsights(
  businessId: string,
  range: AnalyticsDateRange,
): Promise<BusinessInsights> {
  const [current, previous] = await Promise.all([
    fetchAnalyticsPayload(businessId, range.from, range.to),
    fetchAnalyticsPayload(businessId, range.previousFrom, range.previousTo),
  ]);

  return {
    range,
    current,
    previous,
    customers: {
      totalActive: current.customers.totalActive,
      new: countMetric(current.customers.new, previous.customers.new),
      returning: countMetric(current.customers.returning, previous.customers.returning),
      repeatRate: rateMetric({
        currentRate: current.customers.repeatRate,
        previousRate: previous.customers.repeatRate,
        numerator: current.customers.returning,
        denominator: current.customers.periodQualifying,
      }),
    },
    bookings: {
      created: countMetric(current.bookings.created, previous.bookings.created),
      completed: countMetric(current.bookings.completed, previous.bookings.completed),
      cancelled: countMetric(current.bookings.cancelled, previous.bookings.cancelled),
      active: current.bookings.active,
    },
    value: {
      recorded: currencyMetrics(current.value.recorded, previous.value.recorded),
      completed: currencyMetrics(current.value.completed, previous.value.completed),
      average: currencyMetrics(current.value.average, previous.value.average),
      deposits: currencyMetrics(current.value.deposits, previous.value.deposits),
    },
    operations: {
      onTimeRate: rateMetric({
        currentRate: current.operations.onTimeRate,
        previousRate: previous.operations.onTimeRate,
        numerator: current.operations.onTimeCount,
        denominator: current.operations.onTimeEligible,
      }),
      overdue: current.operations.overdue,
      cancellationRate: rateMetric({
        currentRate: current.operations.cancellationRate,
        previousRate: previous.operations.cancellationRate,
        numerator: current.bookings.cancelled,
        denominator: current.operations.cancellationEligible,
      }),
      averageFulfillmentMinutes: nullableCountMetric(
        current.operations.averageFulfillmentMinutes,
        previous.operations.averageFulfillmentMinutes,
      ),
    },
    feedback: {
      responses: countMetric(current.feedback.responses, previous.feedback.responses),
      averageRating: nullableCountMetric(
        current.feedback.averageRating,
        previous.feedback.averageRating,
      ),
      onTimePercentage: rateMetric({
        currentRate: current.feedback.onTimePercentage,
        previousRate: previous.feedback.onTimePercentage,
        numerator: current.feedback.onTimeYes,
        denominator: current.feedback.responses,
      }),
      metExpectationsPercentage: rateMetric({
        currentRate: current.feedback.metExpectationsPercentage,
        previousRate: previous.feedback.metExpectationsPercentage,
        numerator: current.feedback.metExpectationsYes,
        denominator: current.feedback.responses,
      }),
    },
    issues: {
      opened: countMetric(current.issues.opened, previous.issues.opened),
      resolved: countMetric(current.issues.resolved, previous.issues.resolved),
      resolutionRate: rateMetric({
        currentRate: current.issues.resolutionRate,
        previousRate: previous.issues.resolutionRate,
        numerator:
          current.issues.resolutionRate === null
            ? 0
            : Math.round(current.issues.resolutionRate * current.issues.opened),
        denominator: current.issues.opened,
      }),
      categories: current.issues.categories,
    },
  };
}
