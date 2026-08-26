"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type BookingDetailSectionProps = {
  id: string;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  attention?: boolean;
  children: ReactNode;
};

type HashTargetListener = (target: string | null) => void;
type SubscribeToHashTarget = (listener: HashTargetListener) => () => void;

const BookingDetailHashContext = createContext<SubscribeToHashTarget | null>(null);

export function BookingDetailSections({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<HashTargetListener>());
  const subscribe = useCallback<SubscribeToHashTarget>((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    function publishHashTarget() {
      const target = window.location.hash.slice(1) || null;
      listenersRef.current.forEach((listener) => listener(target));
    }

    const initialPublish = window.setTimeout(publishHashTarget, 0);
    window.addEventListener("hashchange", publishHashTarget);
    return () => {
      window.clearTimeout(initialPublish);
      window.removeEventListener("hashchange", publishHashTarget);
    };
  }, []);

  return (
    <BookingDetailHashContext.Provider value={subscribe}>
      {children}
    </BookingDetailHashContext.Provider>
  );
}

export function BookingDetailSection({
  id,
  title,
  summary,
  defaultOpen = false,
  attention = false,
  children,
}: BookingDetailSectionProps) {
  const contentId = useId();
  const triggerId = useId();
  const subscribeToHashTarget = useContext(BookingDetailHashContext);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    return subscribeToHashTarget?.((target) => {
      if (target === id) setOpen(true);
    });
  }, [id, subscribeToHashTarget]);

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-lg border bg-card text-foreground shadow-sm",
        attention ? "border-accent/50" : "border-border",
      )}
    >
      <h2>
        <button
          id={triggerId}
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-5"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-6">{title}</span>
            <span className="mt-0.5 block break-words text-sm font-normal leading-5 text-muted-foreground">
              {summary}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="border-t border-border px-4 py-5 sm:px-5"
      >
        {children}
      </div>
    </section>
  );
}
