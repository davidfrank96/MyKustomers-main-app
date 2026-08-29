import type {
  AnalyticsDateRange,
  AnalyticsRangePreset,
} from "@/features/analytics/types";

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function addUtcYears(value: Date, years: number) {
  const next = new Date(value);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

export function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function previousEquivalentRange(from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from);
  const previousFrom = new Date(from.getTime() - duration);

  return { previousFrom, previousTo };
}

function rangeWithPrevious({
  preset,
  label,
  from,
  to,
  error,
}: {
  preset: AnalyticsRangePreset;
  label: string;
  from: Date;
  to: Date;
  error?: string;
}): AnalyticsDateRange {
  const { previousFrom, previousTo } = previousEquivalentRange(from, to);

  return {
    preset,
    label,
    from,
    to,
    previousFrom,
    previousTo,
    fromInput: dateInputValue(from),
    toInput: dateInputValue(addUtcDays(to, -1)),
    error,
  };
}

export function defaultAnalyticsRange(now = new Date()) {
  const today = startOfUtcDay(now);
  const from = addUtcDays(today, -29);
  const to = addUtcDays(today, 1);

  return rangeWithPrevious({
    preset: "last_30_days",
    label: "Last 30 days",
    from,
    to,
  });
}

export function parseAnalyticsRange(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
) {
  const rawPreset = Array.isArray(params.range) ? params.range[0] : params.range;
  const preset = rawPreset ?? "last_30_days";
  const today = startOfUtcDay(now);

  if (preset === "last_7_days") {
    const to = addUtcDays(today, 1);
    return rangeWithPrevious({
      preset,
      label: "Last 7 days",
      from: addUtcDays(to, -7),
      to,
    });
  }

  if (preset === "last_3_months" || preset === "last_6_months") {
    const to = addUtcDays(today, 1);
    const months = preset === "last_3_months" ? 3 : 6;
    return rangeWithPrevious({
      preset,
      label: `Last ${months} months`,
      from: addUtcMonths(to, -months),
      to,
    });
  }

  if (preset === "this_month") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return rangeWithPrevious({
      preset,
      label: "This month",
      from,
      to: addUtcMonths(from, 1),
    });
  }

  if (preset === "last_month") {
    const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const from = addUtcMonths(thisMonth, -1);
    return rangeWithPrevious({
      preset,
      label: "Last month",
      from,
      to: thisMonth,
    });
  }

  if (preset === "this_year") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return rangeWithPrevious({
      preset,
      label: "This year",
      from,
      to: addUtcYears(from, 1),
    });
  }

  if (preset === "custom") {
    const fromInput = Array.isArray(params.from) ? params.from[0] : params.from;
    const toInput = Array.isArray(params.to) ? params.to[0] : params.to;
    const from = parseDateInput(fromInput);
    const inclusiveTo = parseDateInput(toInput);

    if (!from || !inclusiveTo) {
      return {
        ...defaultAnalyticsRange(now),
        preset: "custom" as const,
        error: "Choose a valid custom start and end date.",
      };
    }

    const to = addUtcDays(inclusiveTo, 1);

    if (from >= to) {
      return {
        ...defaultAnalyticsRange(now),
        preset: "custom" as const,
        error: "Choose a custom range where the start date is before the end date.",
      };
    }

    if (to > addUtcYears(from, 5)) {
      return {
        ...defaultAnalyticsRange(now),
        preset: "custom" as const,
        error: "Custom analytics ranges can cover up to five years.",
      };
    }

    return rangeWithPrevious({
      preset,
      label: `${dateInputValue(from)} to ${dateInputValue(inclusiveTo)}`,
      from,
      to,
    });
  }

  return defaultAnalyticsRange(now);
}
