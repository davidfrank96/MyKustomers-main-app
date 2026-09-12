import { cursorSchema, notificationTypeSchema } from "@/features/notifications/contracts";
import {
  notificationAuth,
  notificationResponse,
  notificationError,
  NotificationHttpError,
} from "@/features/notifications/http";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await notificationAuth();
    const params = new URL(request.url).searchParams;
    const countQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (params.get("countOnly") === "1") {
      const count = await countQuery;
      if (count.error) throw count.error;
      return notificationResponse({ unreadCount: count.count ?? 0 });
    }
    let query = supabase
      .from("notifications")
      .select("id,business_id,booking_id,notification_type,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(26);
    if (params.has("cursorCreatedAt") || params.has("cursorId")) {
      const cursor = cursorSchema.safeParse({
        createdAt: params.get("cursorCreatedAt"),
        id: params.get("cursorId"),
      });
      if (!cursor.success) throw new NotificationHttpError(400);
      const { createdAt, id } = cursor.data;
      query = query.or(
        `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
      );
    }
    const [rows, count] = await Promise.all([query, countQuery]);
    if (rows.error || count.error) throw new Error("notification_read_failed");
    const notifications = (rows.data ?? []).slice(0, 25);
    const businessIds = [...new Set(notifications.map((n) => n.business_id))];
    const bookingIds = notifications.map((n) => n.booking_id);
    const [businesses, bookings] = notifications.length
      ? await Promise.all([
          supabase.from("businesses").select("id,name").in("id", businessIds),
          supabase.from("bookings").select("id,reference").in("id", bookingIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (businesses.error || bookings.error)
      throw new Error("notification_context_failed");
    const last = notifications.at(-1);
    return notificationResponse({
      items: notifications.map((n) => ({
        id: n.id,
        notification_type: notificationTypeSchema.parse(n.notification_type),
        created_at: n.created_at,
        read_at: n.read_at,
        businessName:
          businesses.data?.find((b) => b.id === n.business_id)?.name ?? "Business",
        bookingReference:
          bookings.data?.find((b) => b.id === n.booking_id)?.reference ?? "Booking",
      })),
      unreadCount: count.count ?? 0,
      nextCursor:
        (rows.data?.length ?? 0) > 25 && last
          ? { createdAt: last.created_at, id: last.id }
          : null,
    });
  } catch (error) {
    return notificationError(error);
  }
}
