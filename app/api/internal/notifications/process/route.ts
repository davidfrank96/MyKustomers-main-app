import * as Sentry from "@sentry/nextjs";
import { validWorkerAuthorization } from "@/features/notifications/delivery";
import {
  boundedJson,
  notificationResponse,
  notificationError,
  NotificationHttpError,
} from "@/features/notifications/http";
import { processNotifications } from "@/features/notifications/worker";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (
    !validWorkerAuthorization(
      request.headers.get("authorization"),
      process.env.NOTIFICATION_WORKER_SECRET,
    )
  )
    return notificationResponse({ error: "Unauthorized" }, 401);
  try {
    const body = await boundedJson(request, 256);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length
    )
      throw new NotificationHttpError(400);
    return notificationResponse(await processNotifications());
  } catch (error) {
    if (!(error instanceof NotificationHttpError))
      Sentry.captureMessage("Notification worker unavailable", {
        level: "error",
        tags: { notification_stage: "worker" },
      });
    return notificationError(error);
  }
}
