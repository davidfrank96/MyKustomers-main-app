import {
  MobileQuickActions,
  mobileBackToTopThreshold,
} from "@/components/shared/mobile-quick-actions";

export const bookingsBackToTopThreshold = mobileBackToTopThreshold;

export function BookingsMobileActions() {
  return (
    <MobileQuickActions
      actionHref="/bookings/new"
      actionLabel="Create new booking"
      marker="bookings"
    />
  );
}
