import type { BookingCurrency } from "@/features/bookings/money";
import type { BookingIssueCategory } from "@/features/feedback/validation";

export const analyticsRangePresets = [
  "this_month",
  "last_month",
  "last_30_days",
  "this_year",
  "custom",
] as const;

export type AnalyticsRangePreset = (typeof analyticsRangePresets)[number];

export type AnalyticsDateRange = {
  preset: AnalyticsRangePreset;
  label: string;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  fromInput: string;
  toInput: string;
  error?: string;
};

export type PeriodComparison =
  | { kind: "none"; label: "No previous activity" }
  | { kind: "new"; label: "New activity" }
  | { kind: "flat"; label: "No change" }
  | { kind: "increase" | "decrease"; label: string; percentChange: number };

export type CountMetric = {
  value: number;
  comparison: PeriodComparison;
};

export type RateMetric = {
  value: number | null;
  numerator: number;
  denominator: number;
  comparison: PeriodComparison;
};

export type CurrencyMetric = {
  currency: BookingCurrency;
  amountMinor: number;
  bookingCount: number;
  comparison: PeriodComparison;
};

export type CurrencyAverageMetric = CurrencyMetric;

export type AnalyticsPayload = {
  range: {
    from: string;
    to: string;
    bucket: "day" | "month";
  };
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
    recorded: Omit<CurrencyMetric, "comparison">[];
    completed: Omit<CurrencyMetric, "comparison">[];
    average: Omit<CurrencyAverageMetric, "comparison">[];
    deposits: Omit<CurrencyMetric, "comparison">[];
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
    categories: {
      category: BookingIssueCategory;
      count: number;
    }[];
  };
  trends: {
    bookings: {
      periodStart: string;
      created: number;
      completed: number;
    }[];
    completedValue: {
      periodStart: string;
      currency: BookingCurrency;
      amountMinor: number;
    }[];
    feedbackRating: {
      periodStart: string;
      averageRating: number;
      responses: number;
    }[];
  };
};

export type BusinessInsights = {
  range: AnalyticsDateRange;
  current: AnalyticsPayload;
  previous: AnalyticsPayload;
  customers: {
    totalActive: number;
    new: CountMetric;
    returning: CountMetric;
    repeatRate: RateMetric;
  };
  bookings: {
    created: CountMetric;
    completed: CountMetric;
    cancelled: CountMetric;
    active: number;
  };
  value: {
    recorded: CurrencyMetric[];
    completed: CurrencyMetric[];
    average: CurrencyAverageMetric[];
    deposits: CurrencyMetric[];
  };
  operations: {
    onTimeRate: RateMetric;
    overdue: number;
    cancellationRate: RateMetric;
    averageFulfillmentMinutes: CountMetric;
  };
  feedback: {
    responses: CountMetric;
    averageRating: CountMetric;
    onTimePercentage: RateMetric;
    metExpectationsPercentage: RateMetric;
  };
  issues: {
    opened: CountMetric;
    resolved: CountMetric;
    resolutionRate: RateMetric;
    categories: AnalyticsPayload["issues"]["categories"];
  };
};
