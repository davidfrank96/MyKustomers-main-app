"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowUp, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export const mobileBackToTopThreshold = 480;

type MobileQuickActionsProps = {
  actionHref: Route;
  actionLabel: string;
  marker: "bookings" | "customers";
};

export function MobileQuickActions({
  actionHref,
  actionLabel,
  marker,
}: MobileQuickActionsProps) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    let animationFrame = 0;

    function updateVisibility() {
      animationFrame = 0;
      setShowBackToTop(window.scrollY >= mobileBackToTopThreshold);
    }

    function handleScroll() {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateVisibility);
      }
    }

    updateVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const markerAttributes =
    marker === "bookings"
      ? { "data-bookings-mobile-actions": true }
      : { "data-customers-mobile-actions": true };

  return (
    <div
      {...markerAttributes}
      data-mobile-quick-actions={marker}
      className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 flex flex-col items-center gap-3 lg:hidden"
    >
      <button
        type="button"
        aria-label="Back to top"
        title="Back to top"
        onClick={scrollToTop}
        className={cn(
          "pointer-events-auto grid size-12 place-items-center rounded-full border border-border bg-card text-primary shadow-[0_8px_24px_rgba(23,33,29,0.16)] outline-none transition-[opacity,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
          showBackToTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ArrowUp className="size-5" aria-hidden="true" />
      </button>

      <Link
        href={actionHref}
        aria-label={actionLabel}
        title={actionLabel}
        className="pointer-events-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(19,104,84,0.28)] outline-none transition-colors hover:bg-[#17423a] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="size-7" aria-hidden="true" />
      </Link>
    </div>
  );
}
