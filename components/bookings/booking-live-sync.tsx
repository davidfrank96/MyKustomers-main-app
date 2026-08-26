"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBookingLiveNotification,
  type BookingLiveState,
} from "@/features/bookings/live-sync";
import {
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const POLL_INTERVAL_MS = 5_000;

type BookingLiveSyncProps = {
  bookingId: string;
  initialState: BookingLiveState;
};

export function BookingLiveSync({ bookingId, initialState }: BookingLiveSyncProps) {
  const router = useRouter();
  const currentRef = useRef(initialState);
  const requestRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [notification, setNotification] = useState<ReturnType<
    typeof getBookingLiveNotification
  > | null>(null);

  useEffect(() => {
    currentRef.current = initialState;
  }, [initialState]);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active || document.visibilityState !== "visible" || pollingRef.current) {
        return;
      }

      pollingRef.current = true;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const result = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/sync`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!result.ok) return;

        const nextState = (await result.json()) as BookingLiveState;
        const previousState = currentRef.current;
        if (!nextState.revision || nextState.revision === previousState.revision) return;

        currentRef.current = nextState;
        setNotification(getBookingLiveNotification(previousState, nextState));
        setToastOpen(true);
        startTransition(() => router.refresh());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // The next bounded poll is sufficient; transient polling failures stay silent.
        }
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
        pollingRef.current = false;
      }
    }

    function pollWhenVisible() {
      if (document.visibilityState === "visible") void poll();
    }

    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    window.addEventListener("focus", pollWhenVisible);
    document.addEventListener("visibilitychange", pollWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", pollWhenVisible);
      document.removeEventListener("visibilitychange", pollWhenVisible);
      requestRef.current?.abort();
    };
  }, [bookingId, router]);

  return (
    <ToastProvider swipeDirection="right">
      <ToastRoot
        className="rounded-md border border-border bg-background p-4 shadow-lg"
        open={toastOpen}
        onOpenChange={setToastOpen}
        duration={6_000}
      >
        <ToastTitle className="font-medium">{notification?.title}</ToastTitle>
        <ToastDescription className="mt-1 text-sm text-muted-foreground">
          {notification?.description}
        </ToastDescription>
      </ToastRoot>
      <ToastViewport />
    </ToastProvider>
  );
}
