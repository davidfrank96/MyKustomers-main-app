import type { BookingStatus } from "@/features/bookings/status";

export type BookingLiveState = {
  revision: string;
  status: BookingStatus;
  customerConfirmedAt: string | null;
  feedbackSubmittedAt: string | null;
};

type BookingLiveRevisionInput = Omit<BookingLiveState, "revision"> & {
  updatedAt: string;
};

export function createBookingLiveState({
  status,
  updatedAt,
  customerConfirmedAt,
  feedbackSubmittedAt,
}: BookingLiveRevisionInput): BookingLiveState {
  return {
    revision: [status, updatedAt, customerConfirmedAt ?? "", feedbackSubmittedAt ?? ""].join(
      ":",
    ),
    status,
    customerConfirmedAt,
    feedbackSubmittedAt,
  };
}

export function getBookingLiveNotification(
  previous: BookingLiveState,
  current: BookingLiveState,
) {
  if (
    (!previous.customerConfirmedAt && current.customerConfirmedAt) ||
    (previous.status !== "CONFIRMED" && current.status === "CONFIRMED")
  ) {
    return {
      title: "Customer confirmed",
      description: "The booking now reflects the customer's confirmation.",
    };
  }

  if (!previous.feedbackSubmittedAt && current.feedbackSubmittedAt) {
    return {
      title: "New customer feedback",
      description: "Private feedback is now available on this booking.",
    };
  }

  return {
    title: "Booking updated",
    description: "The latest booking details are now shown.",
  };
}

export function didBookingBecomeCompleted(
  previous: Pick<BookingLiveState, "status">,
  current: Pick<BookingLiveState, "status">,
) {
  return previous.status !== "COMPLETED" && current.status === "COMPLETED";
}
