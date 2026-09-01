"use client";

import Link from "next/link";
import type { Route } from "next";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { AnalyticsRangePreset } from "@/features/analytics/types";

const rangePresets = [
  { value: "last_7_days", label: "7D" },
  { value: "last_30_days", label: "30D" },
  { value: "last_3_months", label: "3M" },
  { value: "last_6_months", label: "6M" },
] as const;

type InsightsRangeSelectorProps = {
  activePreset: AnalyticsRangePreset;
  fromInput: string;
  toInput: string;
};

export function InsightsRangeSelector({
  activePreset,
  fromInput,
  toInput,
}: InsightsRangeSelectorProps) {
  const isPresetVisible = rangePresets.some((preset) => preset.value === activePreset);
  const [customOpen, setCustomOpen] = useState(
    activePreset === "custom" || !isPresetVisible,
  );

  return (
    <div className="space-y-3">
      <div
        className="grid min-h-11 grid-cols-5 overflow-hidden rounded-lg border border-border bg-card"
        aria-label="Insights date range"
      >
        {rangePresets.map((preset) => {
          const active = !customOpen && activePreset === preset.value;

          return (
            <Link
              key={preset.value}
              href={`/insights?range=${preset.value}` as Route}
              aria-current={active ? "page" : undefined}
              onClick={() => setCustomOpen(false)}
              className={cn(
                "grid min-w-0 place-items-center border-r border-border px-1 text-xs font-semibold text-muted-foreground outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[360px]:text-sm",
                active && "bg-primary text-primary-foreground",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-pressed={customOpen}
          onClick={() => setCustomOpen(true)}
          className={cn(
            "flex min-w-0 items-center justify-center gap-1 px-1 text-xs font-semibold text-muted-foreground outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[390px]:gap-1.5 min-[390px]:text-sm",
            customOpen && "bg-primary text-primary-foreground",
          )}
        >
          <CalendarDays
            className="hidden size-3.5 shrink-0 min-[360px]:block"
            aria-hidden="true"
          />
          <span>Custom</span>
        </button>
      </div>

      {customOpen ? (
        <form
          className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_auto]"
          data-insights-custom-range
        >
          <input type="hidden" name="range" value="custom" />
          <label className="min-w-0 space-y-1 text-sm">
            <span className="font-medium">From</span>
            <input
              type="date"
              name="from"
              defaultValue={fromInput}
              className="min-h-11 w-full min-w-0 rounded-md border border-border bg-card px-2 py-2 min-[390px]:px-3"
            />
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span className="font-medium">To</span>
            <input
              type="date"
              name="to"
              defaultValue={toInput}
              className="min-h-11 w-full min-w-0 rounded-md border border-border bg-card px-2 py-2 min-[390px]:px-3"
            />
          </label>
          <div className="col-span-2 flex items-end sm:col-span-1">
            <Button type="submit" className="w-full sm:w-auto">
              Apply
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
