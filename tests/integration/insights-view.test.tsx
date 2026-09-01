import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InsightsRangeSelector } from "@/features/analytics/components/insights-range-selector";
import { InsightsView } from "@/features/analytics/components/insights-view";
import type {
  AnalyticsPayload,
  BusinessInsights,
  PeriodComparison,
} from "@/features/analytics/types";

const noActivity: PeriodComparison = {
  kind: "none",
  label: "No previous activity",
};

const currentPayload: AnalyticsPayload = {
  range: {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-09-01T00:00:00.000Z",
    bucket: "day",
  },
  customers: {
    totalActive: 5,
    new: 5,
    returning: 2,
    periodQualifying: 5,
    repeatRate: 0.4,
  },
  bookings: {
    created: 10,
    completed: 6,
    cancelled: 1,
    active: 3,
  },
  value: {
    recorded: [],
    completed: [],
    average: [],
    deposits: [],
  },
  operations: {
    onTimeEligible: 6,
    onTimeCount: 5,
    onTimeRate: 5 / 6,
    overdue: 3,
    cancellationEligible: 7,
    cancellationRate: 1 / 7,
    averageFulfillmentMinutes: 450,
  },
  feedback: {
    responses: 2,
    averageRating: 4,
    onTimeYes: 2,
    onTimePercentage: 1,
    metExpectationsYes: 1,
    metExpectationsPercentage: 0.5,
  },
  issues: {
    opened: 2,
    resolved: 1,
    resolutionRate: 0.5,
    categories: [
      { category: "LATE_DELIVERY", count: 1 },
      { category: "PAYMENT_BALANCE_ISSUE", count: 1 },
    ],
  },
  trends: {
    bookings: [
      {
        periodStart: "2026-08-24T00:00:00.000Z",
        created: 2,
        completed: 1,
      },
    ],
    completedValue: [],
    feedbackRating: [],
  },
};

const insights: BusinessInsights = {
  range: {
    preset: "last_30_days",
    label: "Last 30 days",
    from: new Date("2026-08-01T00:00:00.000Z"),
    to: new Date("2026-09-01T00:00:00.000Z"),
    previousFrom: new Date("2026-07-01T00:00:00.000Z"),
    previousTo: new Date("2026-08-01T00:00:00.000Z"),
    fromInput: "2026-08-01",
    toInput: "2026-08-31",
  },
  current: currentPayload,
  previous: currentPayload,
  customers: {
    totalActive: 5,
    new: { value: 5, comparison: noActivity },
    returning: { value: 2, comparison: noActivity },
    repeatRate: {
      value: 0.4,
      numerator: 2,
      denominator: 5,
      comparison: noActivity,
    },
  },
  bookings: {
    created: { value: 10, comparison: noActivity },
    completed: { value: 6, comparison: noActivity },
    cancelled: { value: 1, comparison: noActivity },
    active: 3,
  },
  value: {
    recorded: [
      {
        currency: "NGN",
        amountMinor: 1_000_000_428_000_000,
        bookingCount: 10,
        comparison: noActivity,
      },
      {
        currency: "EUR",
        amountMinor: 85_000,
        bookingCount: 1,
        comparison: noActivity,
      },
    ],
    completed: [
      {
        currency: "NGN",
        amountMinor: 385_000_000,
        bookingCount: 6,
        comparison: noActivity,
      },
    ],
    average: [
      {
        currency: "NGN",
        amountMinor: 100_000_042_800_000,
        bookingCount: 10,
        comparison: noActivity,
      },
    ],
    deposits: [
      {
        currency: "NGN",
        amountMinor: 356_200_000,
        bookingCount: 10,
        comparison: noActivity,
      },
    ],
  },
  operations: {
    onTimeRate: {
      value: 5 / 6,
      numerator: 5,
      denominator: 6,
      comparison: noActivity,
    },
    overdue: 3,
    cancellationRate: {
      value: 1 / 7,
      numerator: 1,
      denominator: 7,
      comparison: noActivity,
    },
    averageFulfillmentMinutes: { value: 450, comparison: noActivity },
  },
  feedback: {
    responses: { value: 2, comparison: noActivity },
    averageRating: { value: 4, comparison: noActivity },
    onTimePercentage: {
      value: 1,
      numerator: 2,
      denominator: 2,
      comparison: noActivity,
    },
    metExpectationsPercentage: {
      value: 0.5,
      numerator: 1,
      denominator: 2,
      comparison: noActivity,
    },
  },
  issues: {
    opened: { value: 2, comparison: noActivity },
    resolved: { value: 1, comparison: noActivity },
    resolutionRate: {
      value: 0.5,
      numerator: 1,
      denominator: 2,
      comparison: noActivity,
    },
    categories: currentPayload.issues.categories,
  },
};

describe("InsightsView", () => {
  it("keeps every analytics metric and each currency group in the redesigned view", () => {
    render(<InsightsView insights={insights} />);

    for (const section of [
      "Business overview",
      "Customer activity",
      "Bookings & value",
      "Operations",
      "Feedback",
      "Issues",
    ]) {
      expect(screen.getByRole("heading", { name: section })).toBeVisible();
    }

    for (const metric of [
      "Active customers",
      "Bookings created",
      "Completed bookings",
      "Feedback responses",
      "New customers",
      "Returning customers",
      "Repeat customer rate",
      "Recorded booking value",
      "Completed booking value",
      "Average booking value",
      "Recorded deposits",
      "Active bookings",
      "Cancelled bookings",
      "On-time rate",
      "Overdue bookings",
      "Cancellation rate",
      "Avg fulfilment duration",
      "Average rating",
      "Feedback says on time",
      "Met expectations",
      "Issues opened",
      "Issues resolved",
      "Issue resolution rate",
      "Issue categories",
    ]) {
      expect(screen.getByRole("heading", { name: metric })).toBeVisible();
    }

    const recordedValue = screen
      .getByRole("heading", { name: "Recorded booking value" })
      .closest<HTMLElement>("[data-insights-metric]");
    expect(recordedValue).not.toBeNull();
    expect(within(recordedValue!).getByText("NGN")).toBeVisible();
    expect(within(recordedValue!).getByText("EUR")).toBeVisible();
    expect(within(recordedValue!).getByText("₦10,000,004,280,000")).toBeVisible();
    expect(screen.queryByText(/View all/i)).toBeNull();
  });

  it("provides local scrollers and an accessible booking trend equivalent", () => {
    const { container } = render(<InsightsView insights={insights} />);

    expect(container.querySelectorAll("[data-insights-scroller]")).toHaveLength(4);
    expect(screen.getByLabelText("Customer activity metrics")).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(
      screen.getByText("Aug 24: 2 bookings created, 1 completed"),
    ).toBeInTheDocument();
  });
});

describe("InsightsRangeSelector", () => {
  it("reveals custom dates and collapses them when a preset is selected", () => {
    render(
      <InsightsRangeSelector
        activePreset="last_30_days"
        fromInput="2026-08-01"
        toInput="2026-08-30"
      />,
    );

    expect(screen.queryByLabelText("From")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-08-30");
    expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();

    const sevenDays = screen.getByRole("link", { name: "7D" });
    expect(sevenDays).toHaveAttribute("href", "/insights?range=last_7_days");
    sevenDays.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(sevenDays);
    expect(screen.queryByLabelText("From")).toBeNull();
  });
});
