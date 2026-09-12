import "server-only";
import webPush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  notificationTypeSchema,
  subscriptionSchema,
} from "@/features/notifications/validation";
import { notificationTopic, retryAfterSeconds } from "@/features/notifications/delivery";
import type { Database } from "@/types/database";

type Delivery =
  Database["public"]["Functions"]["claim_notification_push"]["Returns"][number];
function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject)
    throw new Error("notification_configuration_unavailable");
  // Validate once before claiming work; a deployment configuration error must not consume leases.
  webPush.getVapidHeaders(
    "https://fcm.googleapis.com",
    subject,
    publicKey,
    privateKey,
    "aes128gcm",
  );
  return { subject, publicKey, privateKey };
}
export async function sendNotificationDelivery(
  delivery: Delivery,
  vapidDetails: ReturnType<typeof vapidConfig>,
) {
  const subscription = subscriptionSchema.safeParse({
    endpoint: delivery.endpoint,
    keys: { p256dh: delivery.p256dh, auth: delivery.auth_key },
    platform: "web",
  });
  const type = notificationTypeSchema.safeParse(delivery.notification_type);
  if (
    !subscription.success ||
    !type.success ||
    !/^[0-9a-f-]{36}$/i.test(delivery.notification_id)
  )
    return { status: 400, retryAfter: null };
  try {
    const payload = JSON.stringify({
      version: 1,
      notificationId: delivery.notification_id,
      type: type.data,
      unreadCount: Math.min(9999, Math.max(0, Number(delivery.unread_count) || 0)),
    });
    // The audited SDK handles VAPID and standard encryption. Native fetch gives a
    // total timeout, no redirects, and avoids retaining unbounded provider bodies.
    const request = webPush.generateRequestDetails(
      { endpoint: subscription.data.endpoint, keys: subscription.data.keys },
      payload,
      {
        vapidDetails,
        TTL: 86400,
        urgency: "normal",
        topic: notificationTopic(delivery.notification_id),
        contentEncoding: "aes128gcm",
      },
    );
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: request.body ? new Uint8Array(request.body) : undefined,
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      cache: "no-store",
    });
    const result = {
      status: response.status,
      retryAfter: retryAfterSeconds(response.headers.get("retry-after")),
    };
    await response.body?.cancel().catch(() => undefined);
    return result;
  } catch {
    // No raw SDK/provider exception, endpoint, encryption key or payload enters telemetry.
    // A timeout may have reached the provider, so its outcome is terminal/unknown.
    return { status: null, retryAfter: null };
  }
}
export async function processNotifications() {
  const vapidDetails = vapidConfig();
  const supabase = createServiceRoleClient();
  const overdue = await supabase.rpc("process_overdue_notifications", { p_limit: 100 });
  if (overdue.error) throw new Error("notification_overdue_processing_failed");
  let processed = 0;
  let accepted = 0;
  let unknown = 0;
  const started = Date.now();
  for (let batch = 0; batch < 4 && Date.now() - started < 35000; batch++) {
    const claimed = await supabase.rpc("claim_notification_push", { p_limit: 2 });
    if (claimed.error) throw new Error("notification_claim_failed");
    if (!claimed.data?.length) break;
    await Promise.all(
      claimed.data.map(async (delivery) => {
        const result = await sendNotificationDelivery(delivery, vapidDetails);
        const finished = await supabase.rpc("finish_notification_push", {
          p_delivery_id: delivery.delivery_id,
          p_lease_token: delivery.lease_token,
          p_http_status: result.status,
          p_retry_after_seconds: result.retryAfter,
        });
        if (finished.error || !finished.data)
          throw new Error("notification_finish_failed");
        processed++;
        if (result.status && result.status >= 200 && result.status < 300) accepted++;
        if (result.status === null) unknown++;
      }),
    );
  }
  const maintained = await supabase.rpc("maintain_notifications", { p_limit: 1000 });
  if (maintained.error) throw new Error("notification_maintenance_failed");
  if (unknown)
    Sentry.captureMessage("Notification provider outcome unknown", {
      level: "warning",
      tags: { notification_stage: "provider_handoff" },
    });
  return { overdue: overdue.data ?? 0, processed, accepted, unknown };
}
