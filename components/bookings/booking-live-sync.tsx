"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBookingLiveNotification,
  type BookingLiveState,
} from "@/features/bookings/live-sync";
import { PWA_BOOKING_RECONCILE_EVENT } from "@/features/pwa/reconciliation";
import {
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export const BOOKING_POLL_INTERVAL_MS = 10_000;

type BookingLiveSyncProps = {
  bookingId: string;
  initialState: BookingLiveState;
};

export function BookingLiveSync({ bookingId, initialState }: BookingLiveSyncProps) {
  const router = useRouter();
  const currentRef = useRef(initialState);
  const syncRef = useRef<HTMLSpanElement>(null);
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
    syncRef.current?.setAttribute("data-ready", "true");

    async function poll(refreshEvenIfUnchanged = false) {
      if (!active || document.visibilityState !== "visible" || pollingRef.current) {
        return;
      }

      pollingRef.current = true;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const result = await fetch(
          `/api/bookings/${encodeURIComponent(bookingId)}/sync`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        if (!result.ok) {
          if (refreshEvenIfUnchanged) startTransition(() => router.refresh());
          return;
        }

        const nextState = (await result.json()) as BookingLiveState;
        const previousState = currentRef.current;
        if (!nextState.revision || nextState.revision === previousState.revision) {
          if (refreshEvenIfUnchanged) startTransition(() => router.refresh());
          return;
        }

        currentRef.current = nextState;
        setNotification(getBookingLiveNotification(previousState, nextState));
        setToastOpen(true);
        startTransition(() => router.refresh());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          if (refreshEvenIfUnchanged) startTransition(() => router.refresh());
        }
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
        pollingRef.current = false;
      }
    }

    function reconcileBooking() {
      void poll(true);
    }

    const interval = window.setInterval(() => void poll(), BOOKING_POLL_INTERVAL_MS);
    window.addEventListener(PWA_BOOKING_RECONCILE_EVENT, reconcileBooking);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(PWA_BOOKING_RECONCILE_EVENT, reconcileBooking);
      requestRef.current?.abort();
    };
  }, [bookingId, router]);

  return (
    <>
      <span ref={syncRef} data-pwa-booking-sync hidden />
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
        <ToastViewport className="bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-4" />
      </ToastProvider>
    </>
  );
}
