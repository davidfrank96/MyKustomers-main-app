import { formatMoneyMinor } from "@/features/bookings/money";
import type { BookingCurrency } from "@/features/bookings/money";
import type { PeriodComparison } from "@/features/analytics/types";

export function compareNumbers(current: number | null, previous: number | null): PeriodComparison {
  const currentValue = current ?? 0;
  const previousValue = previous ?? 0;

  if (previousValue === 0 && currentValue === 0) {
    return { kind: "none", label: "No previous activity" };
  }

  if (previousValue === 0 && currentValue > 0) {
    return { kind: "new", label: "New activity" };
  }

  const change = (currentValue - previousValue) / previousValue;

  if (change === 0) {
    return { kind: "flat", label: "No change" };
  }

  return {
    kind: change > 0 ? "increase" : "decrease",
    percentChange: change,
    label: `${change > 0 ? "+" : ""}${formatPercent(change)} vs previous period`,
  };
}

export function formatInteger(value: number | null) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function formatDecimal(value: number | null, digits = 1) {
  if (value === null) {
    return "No data";
  }

  return new Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(rate: number | null) {
  if (rate === null) {
    return "No data";
  }

  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(rate);
}

export function formatMinutes(value: number | null) {
  if (value === null) {
    return "No data";
  }

  if (value < 60) {
    return `${formatInteger(value)} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

export function formatCurrencyMinor(amountMinor: number, currency: BookingCurrency) {
  return formatMoneyMinor(amountMinor, currency);
}
