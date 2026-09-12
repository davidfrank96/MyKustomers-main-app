import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "CUSTOMER_CONFIRMED",
  "CUSTOMER_FEEDBACK_RECEIVED",
  "BOOKING_OVERDUE",
  "AMENDMENT_RESPONDED",
  "ADD_ON_RESPONDED",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;
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
export const preferencesSchema = z
  .object({
    customer_confirmations: z.boolean(),
    customer_feedback: z.boolean(),
    overdue_bookings: z.boolean(),
  })
  .strict();
export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: NotificationPreferences = {
  customer_confirmations: true,
  customer_feedback: true,
  overdue_bookings: true,
};
export const subscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .max(2048)
      .regex(
        /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com)\/[A-Za-z0-9_/?=&%:+.~-]+$/,
      ),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
      })
      .strict(),
    platform: z.enum(["web", "ios", "android", "desktop"]),
  })
  .strict();
export const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});
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
  nextCursor: z.infer<typeof cursorSchema> | null;
};
export const PUSH_DEVICE_COOKIE = "myk-push-device";
export const NOTIFICATIONS_CHANGED = "myk:notifications-changed";
