import type { HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import {
  getBookingStatusLabel,
  type BookingStatus,
} from "@/features/bookings/status";
import { cn } from "@/lib/utils/cn";

const statusClassNames: Record<BookingStatus, string> = {
  DRAFT: "border-border bg-muted text-foreground",
  AWAITING_CUSTOMER: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  CONFIRMED: "border-primary/20 bg-primary/5 text-primary",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  READY: "border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]",
  DELIVERED: "border-[#a5f3fc] bg-[#ecfeff] text-[#155e75]",
  COMPLETED: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
  CANCELLED: "border-destructive/25 bg-destructive/5 text-destructive",
};

const overdueClassName = "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]";

export function getBookingStatusBadgeClassName(
  status: BookingStatus,
  overdue = false,
) {
  return overdue ? overdueClassName : statusClassNames[status];
}

export function BookingStatusBadge({
  status,
  overdue = false,
  className,
  ...props
}: {
  status: BookingStatus;
  overdue?: boolean;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  return (
    <Badge
      variant="outline"
      className={cn(getBookingStatusBadgeClassName(status, overdue), className)}
      {...props}
    >
      {overdue ? "Overdue" : getBookingStatusLabel(status)}
    </Badge>
  );
}
