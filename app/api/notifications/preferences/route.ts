import { preferencesSchema } from "@/features/notifications/validation";
import { defaultPreferences } from "@/features/notifications/contracts";
import {
  boundedJson,
  notificationAuth,
  notificationResponse,
  notificationError,
  NotificationHttpError,
} from "@/features/notifications/http";
export async function GET() {
  try {
    const { supabase, user } = await notificationAuth();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("customer_confirmations,customer_feedback,overdue_bookings")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return notificationResponse({ preferences: data ?? defaultPreferences });
  } catch (error) {
    return notificationError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const { supabase, user } = await notificationAuth(request);
    const parsed = preferencesSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new NotificationHttpError(400);
    // Column-limited UPDATE grants intentionally exclude user_id: don't upsert it.
    const existing = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const inserted = await supabase
        .from("notification_preferences")
        .insert({ user_id: user.id, ...parsed.data });
      if (inserted.error && inserted.error.code !== "23505") throw inserted.error;
    }
    const { error } = await supabase
      .from("notification_preferences")
      .update(parsed.data)
      .eq("user_id", user.id);
    if (error) throw error;
    return notificationResponse({ ok: true });
  } catch (error) {
    return notificationError(error);
  }
}
