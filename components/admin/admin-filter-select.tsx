"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterOption = { label: string; value: string };

export function AdminFilterSelect({
  label,
  options,
  param,
  value,
}: {
  label: string;
  options: FilterOption[];
  param: string;
  value: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-w-0 sm:w-60">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("page");
          if (nextValue === "all") params.delete(param);
          else params.set(param, nextValue);
          const query = params.toString();
          startTransition(() => {
            router.replace((query ? `${pathname}?${query}` : pathname) as Route, {
              scroll: false,
            });
          });
        }}
      >
        <SelectTrigger aria-label={label} aria-busy={isPending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
