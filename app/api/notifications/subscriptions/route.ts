import { subscriptionSchema } from "@/features/notifications/validation";
import { cookies } from "next/headers";
import { z } from "zod";
import { PUSH_DEVICE_COOKIE } from "@/features/notifications/contracts";
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
    const deviceId = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value;
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id,revoked_at,last_seen_at")
      .eq("user_id", user.id);
    if (error) throw error;
    const device = data?.find((d) => d.id === deviceId);
    return notificationResponse({
      enabled: Boolean(
        device &&
        !device.revoked_at &&
        Date.parse(device.last_seen_at) > Date.now() - 180 * 86400000,
      ),
      configured: Boolean(
        process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
        process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
      ),
    });
  } catch (error) {
    return notificationError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { supabase } = await notificationAuth(request);
    if (
      !process.env.WEB_PUSH_VAPID_PRIVATE_KEY ||
      !process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
    )
      throw new NotificationHttpError(503);
    const parsed = subscriptionSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new NotificationHttpError(400);
    const { endpoint, keys, platform } = parsed.data;
    const { data, error } = await supabase.rpc("register_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: keys.p256dh,
      p_auth_key: keys.auth,
      p_platform: platform,
    });
    if (error || !data)
      throw new NotificationHttpError(error?.code === "42501" ? 409 : 503);
    (await cookies()).set(PUSH_DEVICE_COOKIE, data, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 365 * 86400,
    });
    return notificationResponse({ ok: true });
  } catch (error) {
    return notificationError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { supabase } = await notificationAuth(request);
    const cookieStore = await cookies();
    const id = z.string().uuid().safeParse(cookieStore.get(PUSH_DEVICE_COOKIE)?.value);
    if (id.success) {
      const { error } = await supabase.rpc("remove_push_subscription", {
        p_subscription_id: id.data,
      });
      if (error) throw error;
    }
    cookieStore.delete(PUSH_DEVICE_COOKIE);
    return notificationResponse({ ok: true });
  } catch (error) {
    return notificationError(error);
  }
}
