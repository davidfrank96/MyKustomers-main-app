import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
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
    // pg_net waits 10 seconds; provider retries can take longer. Next keeps
    // this bounded task alive after the acknowledgement, within maxDuration.
    after(async () => {
      try {
        await processNotifications();
      } catch {
        Sentry.captureMessage("Notification worker unavailable", {
          level: "error",
          tags: { notification_stage: "worker" },
        });
      }
    });
    return notificationResponse({ accepted: true }, 202);
  } catch (error) {
    if (!(error instanceof NotificationHttpError))
      Sentry.captureMessage("Notification worker unavailable", {
        level: "error",
        tags: { notification_stage: "worker" },
      });
    return notificationError(error);
  }
}
