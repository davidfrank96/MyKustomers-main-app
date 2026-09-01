"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomerRow } from "@/components/customers/customer-row";
import type { CustomerListItem } from "@/features/customers/queries";
import type { CustomerArchiveFilter } from "@/features/customers/validation";

type CustomerLoadMoreResponse = {
  customers: CustomerListItem[];
  hasMore: boolean;
};

type CustomerLoadMoreListProps = {
  initialCustomers: CustomerListItem[];
  total: number;
  q: string;
  status: CustomerArchiveFilter;
  canDelete?: boolean;
};

function isLoadMoreResponse(value: unknown): value is CustomerLoadMoreResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomerLoadMoreResponse>;
  return Array.isArray(candidate.customers) && typeof candidate.hasMore === "boolean";
}

export function CustomerLoadMoreList(props: CustomerLoadMoreListProps) {
  const authoritativeRevision = JSON.stringify([
    props.total,
    props.q,
    props.status,
    props.initialCustomers,
  ]);

  return <CustomerLoadMoreListState key={authoritativeRevision} {...props} />;
}

function CustomerLoadMoreListState({
  initialCustomers,
  total,
  q,
  status,
  canDelete,
}: CustomerLoadMoreListProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [visibleTotal, setVisibleTotal] = useState(total);
  const [hasMore, setHasMore] = useState(initialCustomers.length < total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const requestPending = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const handleLifecycle = useCallback(
    (customerId: string, operation: "archive" | "restore" | "delete") => {
      if (operation === "delete") {
        setCustomers((current) =>
          current.filter((customer) => customer.id !== customerId),
        );
        setVisibleTotal((current) => Math.max(0, current - 1));
        return;
      }

      const remainsInFilter = status === "all";
      if (remainsInFilter) {
        setCustomers((current) =>
          current.map((customer) =>
            customer.id === customerId
              ? {
                  ...customer,
                  archived_at: operation === "archive" ? new Date().toISOString() : null,
                }
              : customer,
          ),
        );
      } else {
        setCustomers((current) =>
          current.filter((customer) => customer.id !== customerId),
        );
        setVisibleTotal((current) => Math.max(0, current - 1));
      }
    },
    [status],
  );

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
      const appended = payload.customers.filter(
        (customer) => !existingIds.has(customer.id),
      );
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
        {customers.map((customer) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            canDelete={Boolean(canDelete)}
            onLifecycle={handleLifecycle}
          />
        ))}
      </Card>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {customers.length} of {visibleTotal} customers.
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
