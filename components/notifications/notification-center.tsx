"use client";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  NOTIFICATIONS_CHANGED,
  notificationCopy,
  type NotificationList,
} from "@/features/notifications/contracts";
import {
  notificationRequest,
  notificationsChanged,
  registerNotificationWorker,
  updateAppBadge,
} from "@/features/notifications/client";

export function NotificationListView() {
  const [data, setData] = useState<NotificationList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadedBefore = useRef(new Date().toISOString());
  const load = useCallback(async (cursor?: NotificationList["nextCursor"]) => {
    setBusy(true);
    setError("");
    try {
      const query = cursor
        ? `?cursorCreatedAt=${encodeURIComponent(cursor.createdAt)}&cursorId=${cursor.id}`
        : "";
      const next = await notificationRequest<NotificationList>(query);
      if (!cursor) loadedBefore.current = new Date().toISOString();
      setData((current) => ({
        ...next,
        items:
          cursor && current
            ? [
                ...current.items,
                ...next.items.filter(
                  (item) => !current.items.some((old) => old.id === item.id),
                ),
              ]
            : next.items,
      }));
      await updateAppBadge(next.unreadCount);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load notifications.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  async function markAllRead() {
    setBusy(true);
    setError("");
    try {
      await notificationRequest("/read", {
        method: "POST",
        body: JSON.stringify({ all: true, before: loadedBefore.current }),
      });
      notificationsChanged();
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not mark notifications as read.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !data?.unreadCount}
          onClick={() => void markAllRead()}
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          Mark all read
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={"/settings#notifications" as Route}>
            <Settings className="size-4" aria-hidden="true" />
            Preferences
          </Link>
        </Button>
      </div>
      {error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={busy}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {!data && busy ? (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          Loading notifications…
        </p>
      ) : null}
      {data?.items.length === 0 ? (
        <div className="py-10 text-center">
          <Bell
            className="mx-auto mb-3 size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="font-medium">You’re all caught up.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Booking updates will appear here.
          </p>
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {data?.items.map((item) => (
          <li key={item.id}>
            {/* A normal document navigation lets the resolver switch the business cookie. No prefetch can mark a notification read. */}
            <a
              href={`/notifications/open/${item.id}`}
              className="flex min-h-20 gap-3 rounded-md px-2 py-4 outline-offset-2 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                className={`mt-2 size-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-primary"}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block break-words text-sm font-medium leading-6">
                  {notificationCopy[item.notification_type].title}
                </span>
                <span className="block break-words text-sm leading-5 text-muted-foreground">
                  {item.businessName} · {item.bookingReference}
                </span>
                <span className="flex flex-wrap gap-x-2 text-xs leading-5 text-muted-foreground">
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <span>{item.read_at ? "Read" : "Unread"}</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {data?.nextCursor ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => void load(data.nextCursor)}
        >
          {busy ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const lastRefresh = useRef(0);
  const refresh = useCallback(async (force = false) => {
    if (
      document.visibilityState === "hidden" ||
      (!force && Date.now() - lastRefresh.current < 2000)
    )
      return;
    lastRefresh.current = Date.now();
    try {
      const result = await notificationRequest<{ unreadCount: number }>("?countOnly=1");
      setCount(result.unreadCount);
      await updateAppBadge(result.unreadCount);
    } catch {
      /* The list has a visible retry state; no background alert or prompt. */
    }
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      void registerNotificationWorker().catch(() => undefined);
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    const reconcile = () => {
      void refresh();
    };
    const changed = () => {
      void refresh(true);
    };
    const message = (event: MessageEvent) => {
      if (event.data?.type === "MYK_NOTIFICATION_RECEIVED") void refresh(true);
    };
    window.addEventListener("focus", reconcile);
    window.addEventListener("pageshow", reconcile);
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener(NOTIFICATIONS_CHANGED, changed);
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      active = false;
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("pageshow", reconcile);
      window.removeEventListener("online", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener(NOTIFICATIONS_CHANGED, changed);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [refresh]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        void refresh(true);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        >
          <Bell className="size-5" aria-hidden="true" />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
            >
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>Updates across your businesses.</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <NotificationListView />
        </div>
      </DialogContent>
    </Dialog>
  );
}
