import {
  CircleCheck,
  CirclePlay,
  CircleX,
  Clock3,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type OperationalProgressTimestamp = {
  value: string | null;
  displayValue: string;
};

type BookingOperationalProgressProps = {
  started: OperationalProgressTimestamp;
  ready: OperationalProgressTimestamp;
  delivered: OperationalProgressTimestamp;
  completed: OperationalProgressTimestamp;
  cancelled: OperationalProgressTimestamp;
};

type OperationalStage = {
  key: keyof BookingOperationalProgressProps;
  label: string;
  icon: LucideIcon;
};

const stages: OperationalStage[] = [
  { key: "started", label: "Started", icon: CirclePlay },
  { key: "ready", label: "Ready", icon: Clock3 },
  { key: "delivered", label: "Delivered", icon: Truck },
  { key: "completed", label: "Completed", icon: CircleCheck },
  { key: "cancelled", label: "Cancelled", icon: CircleX },
];

export function BookingOperationalProgress(props: BookingOperationalProgressProps) {
  return (
    <ol aria-label="Booking operational progress" className="mx-auto max-w-3xl">
      {stages.map((stage, index) => {
        const timestamp = props[stage.key];
        const occurred = Boolean(timestamp.value);
        const cancelled = stage.key === "cancelled" && occurred;
        const Icon = stage.icon;

        return (
          <li
            key={stage.key}
            data-stage={stage.key}
            data-state={cancelled ? "cancelled" : occurred ? "occurred" : "pending"}
            className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-3 last:pb-0 sm:gap-4 sm:pb-4"
          >
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-5 top-10 -translate-x-px border-l border-dashed border-border"
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 grid size-10 place-items-center rounded-full border bg-muted/50 text-muted-foreground",
                occurred && "border-primary/20 bg-primary/[0.07] text-primary",
                cancelled && "border-destructive/25 bg-destructive/5 text-destructive",
              )}
              aria-hidden="true"
            >
              <Icon className="size-[1.125rem]" strokeWidth={2} />
            </span>

            <div
              className={cn(
                "min-w-0 border-b border-border pb-3 sm:pb-4",
                index === stages.length - 1 && "border-b-0 pb-0 sm:pb-0",
              )}
            >
              <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p
                  className={cn(
                    "text-sm font-semibold leading-5 text-foreground sm:text-base sm:leading-6",
                    cancelled && "text-destructive",
                  )}
                >
                  {stage.label}
                </p>
                {occurred ? (
                  <time
                    dateTime={timestamp.value ?? undefined}
                    className={cn(
                      "break-words text-[0.8125rem] leading-5 text-muted-foreground sm:text-sm",
                      cancelled && "text-destructive",
                    )}
                  >
                    {timestamp.displayValue}
                  </time>
                ) : (
                  <span className="inline-flex min-h-6 items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[0.8125rem] font-medium leading-5 text-muted-foreground sm:text-sm">
                    Not scheduled
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
