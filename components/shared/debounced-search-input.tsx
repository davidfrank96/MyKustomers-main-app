"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type DebouncedSearchInputProps = {
  clearLabel: string;
  initialValue: string;
  label: string;
  placeholder: string;
};

export function buildSearchHref({
  pathname,
  searchParams,
  query,
}: {
  pathname: string;
  searchParams: { toString(): string };
  query: string;
}) {
  const nextParams = new URLSearchParams(searchParams.toString());
  const normalizedQuery = query.trim().slice(0, 80);

  nextParams.delete("page");
  if (normalizedQuery) {
    nextParams.set("q", normalizedQuery);
  } else {
    nextParams.delete("q");
  }

  const queryString = nextParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function DebouncedSearchInput({
  clearLabel,
  initialValue,
  label,
  placeholder,
}: DebouncedSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebouncedValue(value);
  const [isPending, startTransition] = useTransition();
  const lastRequestedQuery = useRef(initialValue.trim());
  const urlQuery = (searchParams.get("q") ?? "").trim();
  const isSearching = value.trim().slice(0, 80) !== urlQuery || isPending;
  const routerRef = useRef(router);
  const location = useRef({
    pathname,
    searchParams: new URLSearchParams(searchParams.toString()),
    urlQuery,
  });

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    location.current = {
      pathname,
      searchParams: new URLSearchParams(searchParams.toString()),
      urlQuery,
    };
  }, [pathname, searchParams, urlQuery]);

  useEffect(() => {
    if (urlQuery !== lastRequestedQuery.current) {
      lastRequestedQuery.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  const navigateToQuery = useCallback(
    (nextValue: string) => {
      const normalizedQuery = nextValue.trim().slice(0, 80);
      const currentLocation = location.current;
      if (
        normalizedQuery === currentLocation.urlQuery ||
        normalizedQuery === lastRequestedQuery.current
      ) {
        return;
      }

      lastRequestedQuery.current = normalizedQuery;
      const href = buildSearchHref({
        pathname: currentLocation.pathname,
        searchParams: currentLocation.searchParams,
        query: normalizedQuery,
      });
      startTransition(() => routerRef.current.replace(href as Route, { scroll: false }));
    },
    [startTransition],
  );

  useEffect(() => {
    navigateToQuery(debouncedValue);
  }, [debouncedValue, navigateToQuery]);

  function clearSearch() {
    setValue("");
    navigateToQuery("");
  }

  return (
    <form
      className="min-w-0"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigateToQuery(value);
      }}
    >
      <div className="relative min-w-0">
        <Search
          className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          aria-busy={isSearching}
          className="pl-9 pr-20"
        />
        {isSearching ? (
          <LoaderCircle
            className="absolute right-11 top-3.5 size-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-0.5 size-10"
            onClick={clearSearch}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {isSearching ? "Searching..." : ""}
      </span>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
