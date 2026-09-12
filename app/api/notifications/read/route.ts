import { z } from "zod";
import {
  boundedJson,
  notificationAuth,
  notificationResponse,
  notificationError,
  NotificationHttpError,
} from "@/features/notifications/http";
const schema = z.union([
  z.object({ id: z.string().uuid() }).strict(),
  z
    .object({ all: z.literal(true), before: z.string().datetime({ offset: true }) })
    .strict(),
]);
export async function POST(request: Request) {
  try {
    const { supabase, user } = await notificationAuth(request);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new NotificationHttpError(400);
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    query =
      "id" in parsed.data
        ? query.eq("id", parsed.data.id)
        : query.lte("created_at", parsed.data.before);
    const { error } = await query;
    if (error) throw error;
    return notificationResponse({ ok: true });
  } catch (error) {
    return notificationError(error);
  }
}
