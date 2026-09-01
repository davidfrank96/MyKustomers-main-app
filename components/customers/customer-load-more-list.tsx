"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CustomerListItem } from "@/features/customers/queries";
import type { CustomerArchiveFilter } from "@/features/customers/validation";

type CustomerLoadMoreResponse = {
  customers: CustomerListItem[];
  hasMore: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function isLoadMoreResponse(value: unknown): value is CustomerLoadMoreResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomerLoadMoreResponse>;
  return Array.isArray(candidate.customers) && typeof candidate.hasMore === "boolean";
}

export function CustomerLoadMoreList({
  initialCustomers,
  total,
  q,
  status,
}: {
  initialCustomers: CustomerListItem[];
  total: number;
  q: string;
  status: CustomerArchiveFilter;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [hasMore, setHasMore] = useState(initialCustomers.length < total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const requestPending = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function loadMore() {
    const cursor = customers.at(-1);
    if (!cursor || !hasMore || requestPending.current) return;

    requestPending.current = true;
    setLoading(true);
    setError("");
    setAnnouncement("");
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const params = new URLSearchParams({
        status,
        cursorCreatedAt: cursor.created_at,
        cursorId: cursor.id,
      });
      if (q) params.set("q", q);

      const response = await fetch(`/api/customers/list?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isLoadMoreResponse(payload)) {
        throw new Error("Invalid customer list response");
      }

      const existingIds = new Set(customers.map((customer) => customer.id));
      const appended = payload.customers.filter((customer) => !existingIds.has(customer.id));
      setCustomers((current) => [...current, ...appended]);
      setHasMore(payload.hasMore);
      setAnnouncement(
        appended.length > 0
          ? `${appended.length} more ${appended.length === 1 ? "customer" : "customers"} loaded.`
          : "All customers are loaded.",
      );
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError("We couldn’t load more customers. Check your connection and try again.");
    } finally {
      if (!controller.signal.aborted) {
        requestPending.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <Card className="divide-y divide-border overflow-hidden">
        {customers.map((customer) => {
          const contact = customer.phone || customer.email || "No contact saved";
          const initial = customer.name.trim().charAt(0).toUpperCase() || "C";

          return (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}` as Route}
              className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-muted/60 sm:px-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-primary">
                {initial}
              </span>
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold leading-5 sm:text-base">
                      {customer.name}
                    </h2>
                    {customer.archived_at ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                    {contact}
                  </p>
                </div>
                <p className="mt-1 shrink-0 text-xs text-muted-foreground sm:mt-0 sm:text-sm">
                  Customer since {formatDate(customer.created_at)}
                </p>
              </div>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </Card>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {customers.length} of {total} customers.
        </p>
        {hasMore ? (
          <Button type="button" variant="secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Loading more…" : "Load more"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}
