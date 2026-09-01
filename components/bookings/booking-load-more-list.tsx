"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deriveBalanceMinor, formatMoneyMinor } from "@/features/bookings/money";
import type { BookingWithCustomer } from "@/features/bookings/queries";
import { isBookingOverdue } from "@/features/bookings/status";
import type { BookingListFilter } from "@/features/bookings/validation";

type BookingLoadMoreResponse = {
  bookings: BookingWithCustomer[];
  hasMore: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function isLoadMoreResponse(value: unknown): value is BookingLoadMoreResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BookingLoadMoreResponse>;
  return Array.isArray(candidate.bookings) && typeof candidate.hasMore === "boolean";
}

export function BookingLoadMoreList({
  initialBookings,
  total,
  q,
  filter,
}: {
  initialBookings: BookingWithCustomer[];
  total: number;
  q: string;
  filter: BookingListFilter;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [hasMore, setHasMore] = useState(initialBookings.length < total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const requestPending = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function loadMore() {
    const cursor = bookings.at(-1);
    if (!cursor || !hasMore || requestPending.current) return;

    requestPending.current = true;
    setLoading(true);
    setError("");
    setAnnouncement("");
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const params = new URLSearchParams({
        filter,
        cursorCreatedAt: cursor.created_at,
        cursorId: cursor.id,
      });
      if (q) params.set("q", q);

      const response = await fetch(`/api/bookings/list?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isLoadMoreResponse(payload)) {
        throw new Error("Invalid booking list response");
      }

      const existingIds = new Set(bookings.map((booking) => booking.id));
      const appended = payload.bookings.filter((booking) => !existingIds.has(booking.id));
      setBookings((current) => [...current, ...appended]);
      setHasMore(payload.hasMore);
      setAnnouncement(
        appended.length > 0
          ? `${appended.length} more ${appended.length === 1 ? "booking" : "bookings"} loaded.`
          : "All bookings are loaded.",
      );
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError("We couldn’t load more bookings. Check your connection and try again.");
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
        {bookings.map((booking) => {
          const balance = deriveBalanceMinor(
            booking.total_amount_minor,
            booking.deposit_amount_minor,
          );
          const overdue = isBookingOverdue({
            scheduledFor: booking.scheduled_for,
            status: booking.status,
          });

          return (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}` as Route}
              className="group block min-w-0 p-4 transition-colors hover:bg-muted/60 sm:px-5"
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[0.6875rem] font-semibold text-muted-foreground sm:text-xs">
                      {booking.reference}
                    </span>
                    <BookingStatusBadge status={booking.status} overdue={overdue} />
                  </div>
                  <h2 className="mt-1.5 truncate text-sm font-semibold leading-5 sm:text-base">
                    {booking.title}
                  </h2>
                  <p className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                    {booking.customer?.name ?? "Customer unavailable"} ·{" "}
                    {formatDate(booking.scheduled_for)}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-right">
                  <div className="min-w-0 text-xs leading-5 text-muted-foreground sm:text-sm">
                    <p className="break-all font-medium text-foreground sm:break-words">
                      {formatMoneyMinor(booking.total_amount_minor, booking.currency)}
                    </p>
                    <p className="break-all sm:break-words">
                      Balance {formatMoneyMinor(balance, booking.currency)}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </Card>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {bookings.length} of {total} bookings.
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
