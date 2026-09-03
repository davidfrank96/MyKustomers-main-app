"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Home,
  Mail,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

// Marketing demo only — never connect to production customer or booking data.
type DemoStep =
  | "idle"
  | "booking-created"
  | "booking-confirmed"
  | "email-sending"
  | "email-sent"
  | "work-pending"
  | "work-in-progress"
  | "feedback-received"
  | "feedback-rated"
  | "insights-waiting"
  | "insights-updated"
  | "resetting";

const demoSequence: ReadonlyArray<{
  step: DemoStep;
  durationMs: number;
  announcement: string;
}> = [
  { step: "idle", durationMs: 500, announcement: "" },
  {
    step: "booking-created",
    durationMs: 1_300,
    announcement: "New booking created",
  },
  {
    step: "booking-confirmed",
    durationMs: 1_300,
    announcement: "Customer confirmed the booking",
  },
  {
    step: "email-sending",
    durationMs: 1_200,
    announcement: "Confirmation email is sending",
  },
  {
    step: "email-sent",
    durationMs: 1_300,
    announcement: "Confirmation email sent",
  },
  {
    step: "work-pending",
    durationMs: 1_200,
    announcement: "Booking work is pending",
  },
  {
    step: "work-in-progress",
    durationMs: 1_300,
    announcement: "Booking is now in progress",
  },
  {
    step: "feedback-received",
    durationMs: 1_100,
    announcement: "Private feedback received",
  },
  {
    step: "feedback-rated",
    durationMs: 1_100,
    announcement: "Private feedback rating received",
  },
  {
    step: "insights-waiting",
    durationMs: 900,
    announcement: "Business insights are updating",
  },
  {
    step: "insights-updated",
    durationMs: 3_000,
    announcement: "Business insights updated",
  },
  { step: "resetting", durationMs: 400, announcement: "" },
] as const;

const stepRank: Record<DemoStep, number> = {
  idle: 0,
  "booking-created": 1,
  "booking-confirmed": 2,
  "email-sending": 3,
  "email-sent": 4,
  "work-pending": 5,
  "work-in-progress": 6,
  "feedback-received": 7,
  "feedback-rated": 8,
  "insights-waiting": 9,
  "insights-updated": 10,
  resetting: 10,
};

const finalStepIndex = demoSequence.findIndex(({ step }) => step === "insights-updated");

const sidebarIcons = [
  Home,
  CalendarDays,
  Mail,
  MessageCircle,
  BarChart3,
  Settings,
] as const;

const statusStyles = {
  created: "bg-muted text-muted-foreground",
  confirmed: "bg-[#e8f4e9] text-[#286437]",
  sending: "bg-[#edf3f7] text-[#405b6b]",
  sent: "bg-[#e5f2fb] text-[#145da0]",
  pending: "bg-[#f6f1e8] text-[#745b31]",
  progress: "bg-[#fff2df] text-[#9a4d08]",
  feedback: "bg-[#f1e8ff] text-[#7436be]",
} as const;

function DemoActivityRow({
  testId,
  visible,
  icon: Icon,
  iconClassName,
  title,
  description,
  status,
  statusClassName,
  trailing,
}: {
  testId: string;
  visible: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  status?: string;
  statusClassName?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      aria-hidden={!visible}
      className={`flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card p-2 shadow-[0_1px_3px_rgba(23,33,29,0.04)] transition-[opacity,transform] duration-300 motion-reduce:transform-none motion-reduce:transition-none sm:gap-3 sm:p-3 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1.5 opacity-0"
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary sm:size-10">
        <Icon
          className={`size-[1.125rem] sm:size-5 ${iconClassName ?? ""}`}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
      </div>
      {trailing ?? (
        <span
          data-testid={`${testId}-status`}
          aria-hidden={!status}
          className={`inline-flex min-w-[2.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-1.5 py-1 text-[0.5625rem] font-medium transition-[color,background-color,opacity] duration-300 motion-reduce:transition-none min-[360px]:px-2 min-[360px]:text-[0.625rem] sm:text-xs ${
            status ? "opacity-100" : "opacity-0"
          } ${statusClassName ?? statusStyles.created}`}
        >
          {status ?? "Status"}
        </span>
      )}
    </div>
  );
}

export function HomepageProductDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const [stepIndex, setStepIndex] = useState(finalStepIndex);
  const [isVisible, setIsVisible] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const current = demoSequence[stepIndex] ?? demoSequence[finalStepIndex];
  const rank = stepRank[current.step];
  const isResetting = current.step === "resetting";
  const showBooking = rank >= 1;
  const showEmail = rank >= 3;
  const showWork = rank >= 5;
  const showFeedback = rank >= 7;
  const showInsights = rank >= 9;
  const insightsUpdated = rank >= 10;
  const shouldRun =
    isVisible && isDocumentVisible && !isUserPaused && !prefersReducedMotion;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
      if (mediaQuery.matches) {
        setStepIndex(finalStepIndex);
        setIsUserPaused(false);
      }
    };

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      const fallbackTimeout = globalThis.setTimeout(() => setIsVisible(true), 0);
      return () => globalThis.clearTimeout(fallbackTimeout);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.25));
      },
      { threshold: [0, 0.25, 0.35] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => {
      setIsDocumentVisible(document.visibilityState !== "hidden");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!isVisible || prefersReducedMotion || hasStartedRef.current) return;
    hasStartedRef.current = true;
    setStepIndex(0);
  }, [isVisible, prefersReducedMotion]);

  useEffect(() => {
    if (!shouldRun) return;

    const timeoutId = window.setTimeout(() => {
      setStepIndex((index) => (index + 1) % demoSequence.length);
    }, current.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [current.durationMs, shouldRun, stepIndex]);

  const replay = useCallback(() => {
    if (prefersReducedMotion) {
      setStepIndex(finalStepIndex);
      return;
    }
    hasStartedRef.current = true;
    setIsUserPaused(false);
    setStepIndex(0);
  }, [prefersReducedMotion]);

  const bookingStatus = rank >= 2 ? "Confirmed" : "Created";
  const emailStatus = rank >= 4 ? "Sent" : "Sending…";
  const workStatus = rank >= 6 ? "In progress" : "Pending";
  const newActivityCount = rank >= 5 ? 3 : rank >= 3 ? 2 : 1;
  const progress = [0, 15, 25, 35, 45, 55, 65, 75, 85, 92, 100][rank] ?? 100;
  return (
    <div
      ref={rootRef}
      role="region"
      className="min-w-0"
      aria-label="Illustrative My Kustomers workspace preview"
      aria-describedby="homepage-product-demo-description"
    >
      <p id="homepage-product-demo-description" className="sr-only">
        Demo showing a customer booking being confirmed, followed by email notification,
        work progress, private feedback, and business insights.
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {current.announcement}
      </p>

      <div
        className={`overflow-hidden rounded-lg border border-border bg-card shadow-[0_6px_18px_rgba(23,33,29,0.07)] transition-opacity duration-300 motion-reduce:transition-none ${
          isResetting ? "opacity-60" : "opacity-100"
        }`}
      >
        <div className="flex min-h-[22rem] sm:min-h-[25rem] lg:min-h-[27rem]">
          <div className="flex w-11 shrink-0 flex-col items-center gap-3 border-r border-border bg-[#fbfcfa] py-3 sm:w-14 sm:gap-4 sm:py-4">
            <BrandLogo variant="icon" className="size-7" decorative />
            {sidebarIcons.map((Icon, index) => (
              <span
                key={index}
                className={
                  index === 0
                    ? "grid size-8 place-items-center rounded-md bg-primary text-white"
                    : "grid size-8 place-items-center text-muted-foreground"
                }
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 p-2.5 sm:p-4">
            <div className="mb-3 flex min-w-0 items-start justify-between gap-2 sm:mb-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold sm:text-base">
                  Good morning, Acme Services <span aria-hidden="true">👋</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {"Here's what's happening today."}
                </p>
              </div>
              <span
                className={`hidden shrink-0 items-center gap-1.5 rounded-full bg-primary/5 px-2 py-1 text-[0.6875rem] font-medium text-primary transition-opacity duration-300 motion-reduce:transition-none min-[360px]:inline-flex ${
                  showBooking ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              >
                <span className="size-1.5 rounded-full bg-[#2ca25f]" />
                {newActivityCount} new
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <DemoActivityRow
                testId="demo-booking"
                visible={showBooking}
                icon={CalendarDays}
                title="New booking"
                description="Emma L. · 2 May, 10:00 AM"
                status={bookingStatus}
                statusClassName={
                  rank >= 2 ? statusStyles.confirmed : statusStyles.created
                }
              />
              <DemoActivityRow
                testId="demo-email"
                visible={showEmail}
                icon={Mail}
                title="Email confirmation"
                description="Booking #BK-1421"
                status={emailStatus}
                statusClassName={rank >= 4 ? statusStyles.sent : statusStyles.sending}
              />
              <DemoActivityRow
                testId="demo-work"
                visible={showWork}
                icon={Truck}
                title="Out for delivery"
                description="Order #OR-558 · Today, 2:00 PM"
                status={workStatus}
                statusClassName={rank >= 6 ? statusStyles.progress : statusStyles.pending}
              />
              <DemoActivityRow
                testId="demo-feedback"
                visible={showFeedback}
                icon={MessageCircle}
                iconClassName="text-[#7436be]"
                title="New feedback"
                description="Private response received"
                status={rank >= 8 ? "5 ★" : undefined}
                statusClassName={statusStyles.feedback}
              />
              <DemoActivityRow
                testId="demo-insights"
                visible={showInsights}
                icon={BarChart3}
                title="Weekly insights"
                description={
                  insightsUpdated
                    ? "Bookings up 18% vs last week"
                    : "Waiting for activity…"
                }
                trailing={
                  <svg
                    viewBox="0 0 72 32"
                    className="h-7 w-10 shrink-0 text-[#1f7a45] min-[360px]:w-14 sm:w-16"
                    role="img"
                    aria-label={
                      insightsUpdated
                        ? "Bookings trend increased"
                        : "Bookings trend waiting for activity"
                    }
                  >
                    <polyline
                      points="2,25 14,17 24,21 36,10 48,15 58,4 70,8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength="1"
                      strokeDasharray="1"
                      strokeDashoffset={insightsUpdated ? 0 : 1}
                      className="transition-[stroke-dashoffset,opacity] duration-700 motion-reduce:transition-none"
                      opacity={insightsUpdated ? 1 : 0.25}
                    />
                  </svg>
                }
              />
            </div>
          </div>

          <aside className="hidden w-32 shrink-0 border-l border-border p-3 xl:block">
            <p className="text-xs font-semibold">At a glance</p>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-[0.625rem] text-muted-foreground">Bookings</dt>
                <dd className="text-lg font-semibold">{showBooking ? 128 : 127}</dd>
                <p className="text-[0.625rem] text-muted-foreground">+18% vs last week</p>
              </div>
              <div>
                <dt className="text-[0.625rem] text-muted-foreground">Deliveries</dt>
                <dd className="text-lg font-semibold">{showWork ? 32 : 31}</dd>
                <p className="text-[0.625rem] text-muted-foreground">
                  {rank >= 6 ? "In progress" : "Scheduled"}
                </p>
              </div>
              <div>
                <dt className="text-[0.625rem] text-muted-foreground">Feedback</dt>
                <dd className="text-lg font-semibold">{rank >= 8 ? "4.9 ★" : "4.8 ★"}</dd>
                <p className="text-[0.625rem] text-muted-foreground">Average rating</p>
              </div>
            </dl>
          </aside>
        </div>

        <div className="h-1 bg-primary/5" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex min-h-9 items-center justify-end gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setIsUserPaused((paused) => !paused)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            prefersReducedMotion ? "invisible pointer-events-none" : ""
          }`}
          aria-label={
            isUserPaused
              ? "Resume My Kustomers product demo"
              : "Pause My Kustomers product demo"
          }
          tabIndex={prefersReducedMotion ? -1 : 0}
        >
          {isUserPaused ? (
            <Play className="size-3.5" aria-hidden="true" />
          ) : (
            <Pause className="size-3.5" aria-hidden="true" />
          )}
          {isUserPaused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={replay}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 font-medium hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Replay My Kustomers product demo"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Replay demo
        </button>
      </div>
    </div>
  );
}
