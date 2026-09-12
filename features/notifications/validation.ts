import "server-only";
import { z } from "zod";
import { NOTIFICATION_TYPES, type NotificationPreferences } from "./contracts";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const preferencesSchema = z
  .object({
    customer_confirmations: z.boolean(),
    customer_feedback: z.boolean(),
    overdue_bookings: z.boolean(),
  })
  .strict() satisfies z.ZodType<NotificationPreferences>;
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
