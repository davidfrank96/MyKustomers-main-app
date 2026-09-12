import { notificationTypeSchema } from "@/features/notifications/validation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { setSelectedBusinessId } from "@/lib/auth/current-business";
import { notificationCopy } from "@/features/notifications/contracts";
export async function GET(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await context.params;
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  const unavailable = () =>
    new Response(
      "This notification is no longer available. Open My Kustomers to view your current bookings.",
      { status: 404, headers },
    );
  if (!z.string().uuid().safeParse(notificationId).success) return unavailable();
  // Relative Location headers stay on the browser's origin, including behind
  // proxies whose internal request URL differs from the public hostname.
  const redirectTo = (path: string) =>
    new Response(null, { status: 307, headers: { ...headers, Location: path } });
  const login = () =>
    redirectTo(
      `/login?next=${encodeURIComponent(`/notifications/open/${notificationId}`)}`,
    );
  if (!isSupabasePublicEnvConfigured()) return login();
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return login();
    const { data, error } = await supabase
      .from("notifications")
      .select("id,business_id,booking_id,notification_type,read_at")
      .eq("id", notificationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error)
      return new Response(
        "Notifications are temporarily unavailable. Please try again.",
        { status: 503, headers },
      );
    if (!data) return unavailable();
    const type = notificationTypeSchema.safeParse(data.notification_type);
    if (!type.success) return unavailable();
    // Recheck the target booking with the user's RLS before changing workspace.
    const booking = await supabase
      .from("bookings")
      .select("id")
      .eq("id", data.booking_id)
      .eq("business_id", data.business_id)
      .maybeSingle();
    if (booking.error || !booking.data) return unavailable();
    if (!data.read_at) {
      const read = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", data.id)
        .is("read_at", null)
        .select("id");
      if (read.error || !read.data?.length) return unavailable();
    }
    await setSelectedBusinessId(data.business_id);
    return redirectTo(
      `/bookings/${data.booking_id}${notificationCopy[type.data].anchor}`,
    );
  } catch {
    return new Response("Notifications are temporarily unavailable. Please try again.", {
      status: 503,
      headers,
    });
  }
}
