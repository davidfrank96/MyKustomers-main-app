import { describe, expect, it } from "vitest";
import {
  dateInputValue,
  defaultAnalyticsRange,
  parseAnalyticsRange,
  previousEquivalentRange,
} from "@/features/analytics/date-ranges";
import { compareNumbers, formatCurrencyMinor, formatPercent } from "@/features/analytics/format";
import { analyticsDefinitions, analyticsFinancialTerminology } from "@/features/analytics/definitions";

describe("analytics domain", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("parses supported preset ranges with UTC calendar boundaries", () => {
    expect(parseAnalyticsRange({ range: "this_month" }, now)).toMatchObject({
      label: "This month",
      fromInput: "2026-08-01",
      toInput: "2026-08-31",
    });
    expect(parseAnalyticsRange({ range: "last_month" }, now)).toMatchObject({
      label: "Last month",
      fromInput: "2026-07-01",
      toInput: "2026-07-31",
    });
    expect(parseAnalyticsRange({ range: "this_year" }, now)).toMatchObject({
      label: "This year",
      fromInput: "2026-01-01",
      toInput: "2026-12-31",
    });
  });

  it("uses a 30 calendar day default range including today", () => {
    const range = defaultAnalyticsRange(now);
    expect(range.from.toISOString()).toBe("2026-07-21T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("validates custom range inputs and rejects malformed or unbounded values", () => {
    expect(
      parseAnalyticsRange(
        { range: "custom", from: "2026-08-01", to: "2026-08-19" },
        now,
      ),
    ).toMatchObject({
      preset: "custom",
      fromInput: "2026-08-01",
      toInput: "2026-08-19",
      error: undefined,
    });

    expect(parseAnalyticsRange({ range: "custom", from: "bad", to: "2026-08-19" }, now).error)
      .toBe("Choose a valid custom start and end date.");
    expect(parseAnalyticsRange({ range: "custom", from: "2026-08-20", to: "2026-08-19" }, now).error)
      .toBe("Choose a custom range where the start date is before the end date.");
    expect(parseAnalyticsRange({ range: "custom", from: "2020-01-01", to: "2026-08-19" }, now).error)
      .toBe("Custom analytics ranges can cover up to five years.");
  });

  it("calculates the previous equivalent period without infinity edge cases", () => {
    const { previousFrom, previousTo } = previousEquivalentRange(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(dateInputValue(previousFrom)).toBe("2026-07-01");
    expect(dateInputValue(previousTo)).toBe("2026-08-01");
    expect(compareNumbers(5, 0)).toMatchObject({ kind: "new", label: "New activity" });
    expect(compareNumbers(0, 0)).toMatchObject({ kind: "none" });
    expect(compareNumbers(120, 100)).toMatchObject({ kind: "increase", percentChange: 0.2 });
  });

  it("formats percentages and currency-specific values without cross-currency claims", () => {
    expect(formatPercent(null)).toBe("No data");
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatCurrencyMinor(120_000, "NGN")).toContain("1,200");
    expect(formatCurrencyMinor(85_000, "EUR")).toContain("850");
  });

  it("documents financial and metric definitions outside the UI code", () => {
    expect(analyticsFinancialTerminology).toContain("not independently verified revenue");
    expect(analyticsFinancialTerminology).toContain("never summed across currencies");
    expect(analyticsDefinitions.map((definition) => definition.metric)).toContain(
      "Repeat customer rate",
    );
    expect(analyticsDefinitions.map((definition) => definition.metric)).toContain(
      "Completed booking value",
    );
  });
});
