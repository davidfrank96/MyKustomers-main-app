import type { BookingStatus } from "@/features/bookings/status";
import type { ProviderDeliveryStatus } from "@/features/provider-delivery/model";

export type BookingLiveState = {
  revision: string;
  status: BookingStatus;
  customerConfirmedAt: string | null;
  feedbackSubmittedAt: string | null;
  providerDeliveryStatus?: ProviderDeliveryStatus;
  providerEventAt?: string | null;
};

type BookingLiveRevisionInput = Omit<
  BookingLiveState,
  "revision" | "providerDeliveryStatus" | "providerEventAt"
> & {
  updatedAt: string;
  providerDeliveryStatus?: ProviderDeliveryStatus;
  providerEventAt?: string | null;
};

export function createBookingLiveState({
  status,
  updatedAt,
  customerConfirmedAt,
  feedbackSubmittedAt,
  providerDeliveryStatus = "UNKNOWN",
  providerEventAt = null,
}: BookingLiveRevisionInput): BookingLiveState {
  return {
    revision: [
      status,
      updatedAt,
      customerConfirmedAt ?? "",
      feedbackSubmittedAt ?? "",
      providerDeliveryStatus,
      providerEventAt ?? "",
    ].join(":"),
    status,
    customerConfirmedAt,
    feedbackSubmittedAt,
    providerDeliveryStatus,
    providerEventAt,
  };
}

export function getBookingLiveNotification(
  previous: BookingLiveState,
  current: BookingLiveState,
): { title: string; description: string } | null {
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

  const previousDelivery = previous.providerDeliveryStatus ?? "UNKNOWN";
  const currentDelivery = current.providerDeliveryStatus ?? "UNKNOWN";
  if (previousDelivery !== currentDelivery) {
    if (["UNKNOWN", "DELIVERED", "DEFERRED"].includes(currentDelivery)) {
      return null;
    }
    const title = ["SOFT_BOUNCED", "HARD_BOUNCED", "INVALID"].includes(currentDelivery)
      ? "Email could not be delivered"
      : ["BLOCKED", "COMPLAINT"].includes(currentDelivery)
        ? "Email sending unavailable"
        : "Email delivery updated";
    return {
      title,
      description:
        "The Customer confirmation section now shows the latest provider evidence.",
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
