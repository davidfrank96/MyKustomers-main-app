import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BookingWithCustomer } from "@/features/bookings/queries";
import { cn } from "@/lib/utils/cn";

type AttentionBooking = Pick<
  BookingWithCustomer,
  "id" | "title" | "scheduled_for" | "customer"
>;

type AttentionStatus = "dueToday" | "overdue" | "inProgress" | "ready";

const statusConfiguration = {
  dueToday: {
    title: "Due today",
    viewAllLabel: "View all due today",
    viewAllNoun: "due today",
    viewAllHref: "/bookings?filter=today",
    icon: AlertCircle,
    accentClass: "border-l-rose-500",
    iconClass: "bg-rose-50 text-rose-600",
    titleClass: "text-rose-700",
    badgeClass: "bg-rose-50 text-rose-700",
  },
  overdue: {
    title: "Overdue",
    viewAllLabel: "View all overdue",
    viewAllNoun: "overdue",
    viewAllHref: "/bookings?filter=overdue",
    icon: Clock3,
    accentClass: "border-l-orange-500",
    iconClass: "bg-orange-50 text-orange-600",
    titleClass: "text-orange-700",
    badgeClass: "bg-orange-50 text-orange-700",
  },
  inProgress: {
    title: "In progress",
    viewAllLabel: "View all in progress",
    viewAllNoun: "in progress",
    viewAllHref: "/bookings?filter=IN_PROGRESS",
    icon: Timer,
    accentClass: "border-l-blue-500",
    iconClass: "bg-blue-50 text-blue-600",
    titleClass: "text-blue-700",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  ready: {
    title: "Ready",
    viewAllLabel: "View all ready",
    viewAllNoun: "ready",
    viewAllHref: "/bookings?filter=READY",
    icon: CheckCircle2,
    accentClass: "border-l-emerald-500",
    iconClass: "bg-emerald-50 text-emerald-600",
    titleClass: "text-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
} as const;

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "booking" : "bookings"}`;
}

export function AttentionStatusGroup({
  status,
  bookings,
  totalCount,
  empty,
}: {
  status: AttentionStatus;
  bookings: AttentionBooking[];
  totalCount: number;
  empty: string;
}) {
  const configuration = statusConfiguration[status];
  const Icon = configuration.icon;
  const titleId = `attention-${status}-title`;
  const previewBookings = bookings.slice(0, 3);

  return (
    <Card
      role="group"
      aria-labelledby={titleId}
      data-attention-status={status}
      className={cn(
        "overflow-hidden border-l-[3px]",
        configuration.accentClass,
      )}
    >
      <div className="flex min-h-20 items-center gap-3 px-4 py-3.5 sm:px-5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            configuration.iconClass,
          )}
          aria-hidden="true"
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className={cn("text-base font-semibold", configuration.titleClass)}
          >
            {configuration.title}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {countLabel(totalCount)}
          </p>
        </div>
        <span
          data-attention-count={totalCount}
          className={cn(
            "grid min-w-10 place-items-center rounded-lg px-2.5 py-2 text-base font-semibold",
            configuration.badgeClass,
          )}
          aria-hidden="true"
        >
          {totalCount}
        </span>
      </div>

      <div className="border-t border-border">
        {previewBookings.length === 0 ? (
          <p className="px-4 py-4 text-sm leading-5 text-muted-foreground sm:px-5">
            {empty}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {previewBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}` as Route}
                className="group flex min-h-16 min-w-0 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-5 sm:text-base">
                    {booking.title}
                  </span>
                  <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground sm:text-sm">
                    {booking.customer?.name ?? "Customer unavailable"} ·{" "}
                    {formatDate(booking.scheduled_for)}
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        )}
        {totalCount > 3 ? (
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs sm:px-5 sm:text-sm">
            <span className="text-muted-foreground">
              Showing {previewBookings.length} of {totalCount}
            </span>
            <Link
              href={configuration.viewAllHref as Route}
              aria-label={`View all ${totalCount} ${configuration.viewAllNoun} bookings`}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                configuration.titleClass,
              )}
            >
              {configuration.viewAllLabel}
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function ViewTodayBookingsLink() {
  return (
    <Button
      asChild
      variant="secondary"
      className="h-14 w-full justify-between rounded-lg border-primary/20 bg-primary/[0.03] px-4 text-primary hover:bg-primary/[0.07] hover:text-primary"
    >
      <Link href={"/bookings?filter=today" as Route}>
        <span className="flex min-w-0 items-center gap-3">
          <CalendarDays className="size-5 shrink-0" aria-hidden="true" />
          <span className="break-words text-left">View today&apos;s bookings</span>
        </span>
        <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
      </Link>
    </Button>
  );
}
