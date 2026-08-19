export const bookingStatuses = [
  "DRAFT",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export const terminalBookingStatuses = ["COMPLETED", "CANCELLED"] as const;

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ["CANCELLED"],
  AWAITING_CUSTOMER: ["CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function getAllowedBookingTransitions(status: BookingStatus) {
  return allowedTransitions[status];
}

export function isAllowedBookingTransition(from: BookingStatus, to: BookingStatus) {
  return allowedTransitions[from].includes(to);
}

export function isTerminalBookingStatus(status: BookingStatus) {
  return terminalBookingStatuses.includes(status as (typeof terminalBookingStatuses)[number]);
}

export function getBookingStatusLabel(status: BookingStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function getTransitionLabel(toStatus: BookingStatus) {
  const labels: Record<BookingStatus, string> = {
    DRAFT: "Move to draft",
    AWAITING_CUSTOMER: "Request customer confirmation",
    CONFIRMED: "Confirm booking",
    IN_PROGRESS: "Start work",
    READY: "Mark ready",
    DELIVERED: "Mark delivered",
    COMPLETED: "Complete booking",
    CANCELLED: "Cancel booking",
  };

  return labels[toStatus];
}

export function isBookingOverdue({
  scheduledFor,
  status,
  now = new Date(),
}: {
  scheduledFor: string | null;
  status: BookingStatus;
  now?: Date;
}) {
  if (!scheduledFor || ["DELIVERED", "COMPLETED", "CANCELLED"].includes(status)) {
    return false;
  }

  return new Date(scheduledFor).getTime() < now.getTime();
}

export function isBookingDueToday({
  scheduledFor,
  now = new Date(),
}: {
  scheduledFor: string | null;
  now?: Date;
}) {
  if (!scheduledFor) {
    return false;
  }

  const scheduled = new Date(scheduledFor);
  if (Number.isNaN(scheduled.getTime())) {
    return false;
  }

  return (
    scheduled.getFullYear() === now.getFullYear() &&
    scheduled.getMonth() === now.getMonth() &&
    scheduled.getDate() === now.getDate()
  );
}
