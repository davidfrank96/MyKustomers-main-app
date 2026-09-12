export const NOTIFICATION_TYPES = [
  "CUSTOMER_CONFIRMED",
  "CUSTOMER_FEEDBACK_RECEIVED",
  "BOOKING_OVERDUE",
  "AMENDMENT_RESPONDED",
  "ADD_ON_RESPONDED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const notificationCopy: Record<
  NotificationType,
  { title: string; anchor: string }
> = {
  CUSTOMER_CONFIRMED: { title: "Customer confirmed", anchor: "#customer-confirmation" },
  CUSTOMER_FEEDBACK_RECEIVED: { title: "Feedback received", anchor: "#private-feedback" },
  BOOKING_OVERDUE: { title: "Booking needs attention", anchor: "" },
  AMENDMENT_RESPONDED: {
    title: "Customer confirmed changes",
    anchor: "#booking-changes",
  },
  ADD_ON_RESPONDED: { title: "Customer confirmed an add-on", anchor: "#booking-addons" },
};
export type NotificationPreferences = {
  customer_confirmations: boolean;
  customer_feedback: boolean;
  overdue_bookings: boolean;
};
export const defaultPreferences: NotificationPreferences = {
  customer_confirmations: true,
  customer_feedback: true,
  overdue_bookings: true,
};
export type NotificationItem = {
  id: string;
  notification_type: NotificationType;
  created_at: string;
  read_at: string | null;
  businessName: string;
  bookingReference: string;
};
export type NotificationList = {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: { createdAt: string; id: string } | null;
};
export const PUSH_DEVICE_COOKIE = "myk-push-device";
export const NOTIFICATIONS_CHANGED = "myk:notifications-changed";
