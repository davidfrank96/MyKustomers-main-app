"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./homepage-motion.module.css";

/** Progressive enhancement for server-rendered illustrations; no scroll renders. */
export function HomepageMotionController() {
  const controlRef = useRef<HTMLButtonElement>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const root = controlRef.current?.closest("main");
    if (!root || !("IntersectionObserver" in window)) return;
    const regions = Array.from(
      root.querySelectorAll<HTMLElement>("[data-homepage-motion]"),
    );
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopWire = window.matchMedia("(min-width: 640px)");
    const visible = new Set<Element>();
    const wires = new Map(
      regions.map((region) => [
        region,
        Array.from(region.querySelectorAll<SVGSVGElement>("[data-motion-wire]")),
      ]),
    );

    for (const region of regions) {
      region.dataset.motionReady = "true";
      wires.get(region)?.forEach((wire) => wire.pauseAnimations());
      wires.get(region)?.forEach((wire) => wire.setCurrentTime(0));
    }

    const sync = () => {
      const staticMode = media.matches || pausedRef.current;
      if (controlRef.current) controlRef.current.hidden = media.matches;
      for (const region of regions) {
        const running =
          !staticMode && visible.has(region) && document.visibilityState === "visible";
        region.dataset.motionStatic = String(staticMode);
        region.dataset.motionRunning = String(running);
        if (running) region.dataset.motionEntered = "true";
        wires.get(region)?.forEach((wire) => {
          const fits =
            wire.dataset.motionWire === (desktopWire.matches ? "desktop" : "mobile");
          if (running && fits) wire.unpauseAnimations();
          else wire.pauseAnimations();
        });
      }
    };
    syncRef.current = sync;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        sync();
      },
      { threshold: 0 },
    );
    regions.forEach((region) => observer.observe(region));
    media.addEventListener("change", sync);
    desktopWire.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      desktopWire.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = null;
      for (const region of regions) {
        wires.get(region)?.forEach((wire) => wire.pauseAnimations());
        delete region.dataset.motionReady;
        delete region.dataset.motionEntered;
        delete region.dataset.motionStatic;
        delete region.dataset.motionRunning;
      }
    };
  }, []);

  return (
    <div className={styles.motionControls}>
      <button
        ref={controlRef}
        type="button"
        hidden
        className={styles.motionControl}
        aria-pressed={paused}
        onClick={() => {
          pausedRef.current = !paused;
          setPaused(!paused);
          syncRef.current?.();
        }}
      >
        {paused ? "Resume supporting motion" : "Pause supporting motion"}
      </button>
    </div>
  );
}
