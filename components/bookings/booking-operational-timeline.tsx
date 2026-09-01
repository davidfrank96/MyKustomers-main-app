import {
  Activity,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  FilePenLine,
  FileText,
  History,
  Info,
  PackageCheck,
  PackagePlus,
  Send,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type BookingTimelineEvent = {
  id: string;
  occurredAt: string;
  title: string;
  detail?: string | null;
};

type BookingOperationalTimelineProps = {
  events: BookingTimelineEvent[];
  formatTimestamp: (value: string) => string;
};

export function formatTimelineEventCount(count: number) {
  return `${count} event${count === 1 ? "" : "s"}`;
}

function getEventIcon(event: BookingTimelineEvent): LucideIcon {
  const normalizedTitle = event.title.toLowerCase();

  if (event.id.startsWith("addon-")) return PackagePlus;
  if (event.id.startsWith("amendment-") || normalizedTitle.includes("amendment")) {
    return FilePenLine;
  }
  if (event.id.startsWith("change-") || normalizedTitle.includes("rescheduled")) {
    return CalendarClock;
  }
  if (normalizedTitle.startsWith("created as")) return FileText;
  if (normalizedTitle.endsWith("awaiting customer")) return Send;
  if (normalizedTitle.endsWith("confirmed")) return CircleUserRound;
  if (normalizedTitle.endsWith("in progress")) return Activity;
  if (normalizedTitle.endsWith("ready for delivery")) return PackageCheck;
  if (normalizedTitle.endsWith("delivered")) return Truck;
  if (normalizedTitle.endsWith("completed")) return CheckCircle2;
  if (normalizedTitle.endsWith("cancelled")) return XCircle;

  return History;
}

export function BookingOperationalTimeline({
  events,
  formatTimestamp,
}: BookingOperationalTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No timeline events recorded.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5 text-sm leading-5 text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>A chronological record of key updates to this booking.</p>
      </div>

      <ol role="list" aria-label="Booking activity timeline" className="space-y-3">
        {events.map((event, index) => {
          const EventIcon = getEventIcon(event);
          const isLast = index === events.length - 1;

          return (
            <li
              key={event.id}
              className="relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-2.5"
            >
              {!isLast ? (
                <span
                  className="absolute bottom-[-0.75rem] left-[0.9375rem] top-8 w-px bg-primary/20"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-primary/10 bg-[#e7f1ec] text-primary">
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>

              <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(23,33,29,0.035)] sm:p-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary">
                    <EventIcon className="size-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[0.9375rem] font-semibold leading-5 text-foreground">
                      {event.title}
                    </p>
                    {event.detail ? (
                      <p className="mt-1 break-words text-[0.8125rem] leading-5 text-muted-foreground sm:text-sm">
                        {event.detail}
                      </p>
                    ) : null}
                    <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-[0.8125rem] leading-5 text-muted-foreground sm:text-sm">
                      <CalendarDays
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <time dateTime={event.occurredAt} className="min-w-0 break-words">
                        {formatTimestamp(event.occurredAt)}
                      </time>
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground sm:text-[0.8125rem]">
        <History className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p>Timeline updates as booking activity occurs.</p>
      </div>
    </div>
  );
}
