"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { RefreshCw, WifiOff } from "lucide-react";
import {
  isEligibleOfflineNavigation,
  PWA_BOOKING_RECONCILE_EVENT,
  PWA_RECONCILE_COOLDOWN_MS,
  shouldReconcileAfterResume,
} from "@/features/pwa/reconciliation";

type ReconcileTrigger = "pageshow" | "reconnect" | "resume";

function isFormControl(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function hasChangedControlValues() {
  return [...document.querySelectorAll("input, textarea, select")].some((control) => {
    if (control.tagName === "INPUT") {
      const input = control as HTMLInputElement;
      if (["button", "hidden", "reset", "submit"].includes(input.type)) return false;
      if (input.type === "checkbox" || input.type === "radio") {
        return input.checked !== input.defaultChecked;
      }
      if (input.type === "file") return Boolean(input.files?.length);
      return input.value !== input.defaultValue;
    }
    if (control.tagName === "TEXTAREA") {
      const textarea = control as HTMLTextAreaElement;
      return textarea.value !== textarea.defaultValue;
    }
    const select = control as HTMLSelectElement;
    if (select.multiple) {
      return [...select.options].some(
        (option) => option.selected !== option.defaultSelected,
      );
    }
    const explicitDefault = [...select.options].findIndex(
      (option) => option.defaultSelected,
    );
    return select.selectedIndex !== (explicitDefault >= 0 ? explicitDefault : 0);
  });
}

export function PwaReliabilityCoordinator() {
  const router = useRouter();
  const pathname = usePathname();
  const hiddenAtRef = useRef<number | null>(null);
  const coordinatorRef = useRef<HTMLSpanElement>(null);
  const lastReconcileAtRef = useRef(0);
  const lastReconcilePathRef = useRef<string | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const onlineRef = useRef(true);
  const dirtyFormsRef = useRef(new Set<HTMLFormElement>());
  const dirtyControlsRef = useRef(new Set<HTMLElement>());
  const dirtyPathRef = useRef<string | null>(null);
  const [online, setOnline] = useState(true);
  const [deferredPath, setDeferredPath] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const deferred = deferredPath === pathname;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      onlineRef.current = navigator.onLine;
      setOnline(navigator.onLine);
      coordinatorRef.current?.setAttribute("data-ready", "true");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let settleTimer: number | null = null;
    const pending = pendingNavigationRef.current;
    if (pending && new URL(pending, window.location.href).pathname === pathname) {
      pendingNavigationRef.current = null;
    }

    function hasUnsafeInteraction() {
      if (dirtyPathRef.current !== pathname) {
        dirtyPathRef.current = pathname;
        dirtyFormsRef.current.clear();
        dirtyControlsRef.current.clear();
      }
      for (const form of dirtyFormsRef.current) {
        if (!form.isConnected) dirtyFormsRef.current.delete(form);
      }
      for (const control of dirtyControlsRef.current) {
        if (!control.isConnected) dirtyControlsRef.current.delete(control);
      }
      return (
        dirtyFormsRef.current.size > 0 ||
        dirtyControlsRef.current.size > 0 ||
        hasChangedControlValues() ||
        Boolean(document.querySelector('[role="dialog"][data-state="open"]'))
      );
    }

    function reconcile(trigger: ReconcileTrigger, destination?: string) {
      if (!active) return false;
      if (hasUnsafeInteraction()) {
        setDeferredPath(pathname);
        return false;
      }

      const now = Date.now();
      if (
        lastReconcilePathRef.current === pathname &&
        now - lastReconcileAtRef.current < PWA_RECONCILE_COOLDOWN_MS
      ) {
        return false;
      }
      lastReconcilePathRef.current = pathname;
      lastReconcileAtRef.current = now;
      setDeferredPath(null);
      setRefreshing(true);

      if (
        !destination &&
        document.querySelector('[data-pwa-booking-sync][data-ready="true"]')
      ) {
        window.dispatchEvent(new Event(PWA_BOOKING_RECONCILE_EVENT));
      } else {
        startTransition(() => {
          if (destination) router.push(destination as Route);
          else router.refresh();
        });
      }

      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(
        () => {
          if (active) setRefreshing(false);
        },
        trigger === "reconnect" ? 2_500 : 1_500,
      );
      return true;
    }

    function markDirty(event: Event) {
      if (!isFormControl(event.target)) return;
      if (dirtyPathRef.current !== pathname) {
        dirtyPathRef.current = pathname;
        dirtyFormsRef.current.clear();
        dirtyControlsRef.current.clear();
      }
      const form = event.target.form;
      if (form) dirtyFormsRef.current.add(form);
      else dirtyControlsRef.current.add(event.target);
    }

    function retryPendingNavigationOrRefresh() {
      const destination = pendingNavigationRef.current;
      if (reconcile("resume", destination ?? undefined) && destination) {
        pendingNavigationRef.current = null;
      }
    }

    function clearSubmittedForm(event: Event) {
      if (!(event.target instanceof HTMLFormElement)) return;
      dirtyFormsRef.current.delete(event.target);
      if (event.type === "submit") setDeferredPath(null);
      if (event.type === "reset" && deferred) {
        window.setTimeout(retryPendingNavigationOrRefresh, 0);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && shouldReconcileAfterResume(Date.now() - hiddenAt)) {
        reconcile("resume");
      }
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) reconcile("pageshow");
    }

    function handleOffline() {
      onlineRef.current = false;
      setOnline(false);
      setRefreshing(false);
    }

    function handleOnline() {
      onlineRef.current = true;
      setOnline(true);
      const destination = pendingNavigationRef.current;
      if (reconcile("reconnect", destination ?? undefined) && destination) {
        pendingNavigationRef.current = null;
      }
    }

    function handleOfflineClick(event: MouseEvent) {
      if (onlineRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.hasAttribute("download"))
        return;
      const destination = isEligibleOfflineNavigation(
        target.href,
        window.location.origin,
        window.location.href,
      );
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = destination;
      setOnline(false);
    }

    function handleOfflineSubmit(event: SubmitEvent) {
      if (onlineRef.current) {
        clearSubmittedForm(event);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOnline(false);
    }

    function retryDeferredAfterInteraction() {
      if (!deferred) return;
      window.setTimeout(() => {
        if (!hasUnsafeInteraction()) retryPendingNavigationOrRefresh();
      }, 0);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleOfflineClick, true);
    document.addEventListener("click", retryDeferredAfterInteraction);
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", handleOfflineSubmit, true);
    document.addEventListener("reset", clearSubmittedForm, true);

    return () => {
      active = false;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleOfflineClick, true);
      document.removeEventListener("click", retryDeferredAfterInteraction);
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", handleOfflineSubmit, true);
      document.removeEventListener("reset", clearSubmittedForm, true);
    };
  }, [deferred, pathname, router]);

  return (
    <>
      <span ref={coordinatorRef} data-pwa-reliability-coordinator hidden />
      {online && !deferred && !refreshing ? null : (
        <div
          className="border-b border-border bg-muted px-5 py-2.5 text-sm sm:px-8 lg:px-10"
          role={online ? "status" : "alert"}
          aria-live="polite"
          data-pwa-reliability-status
        >
          <div className="mx-auto flex w-full max-w-6xl items-start gap-2">
            {online ? (
              <RefreshCw
                className={
                  refreshing
                    ? "mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
                    : "mt-0.5 size-4 shrink-0"
                }
                aria-hidden="true"
              />
            ) : (
              <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p className="leading-5 text-muted-foreground">
              {!online
                ? "You're offline. Changes need a connection, and navigation will retry when you're back online."
                : deferred
                  ? "Updates are available. Finish or close the current form or dialog before the page refreshes."
                  : "Refreshing the latest information..."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
