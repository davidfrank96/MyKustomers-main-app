"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Keep the document server-rendered; only disclosure state belongs to the client.
export function LegalSection({
  number,
  title,
  children,
  defaultOpen = false,
}: {
  number: number;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn(
        "legal-section rounded-xl border bg-card shadow-[0_1px_2px_rgba(23,33,29,0.04)]",
        open ? "border-primary/20 bg-primary/[0.025]" : "border-border",
      )}
    >
      <h2>
        <button
          type="button"
          aria-label={`${number}. ${title}`}
          id={`${id}-heading`}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!open)}
          className="flex min-h-14 w-full items-start gap-3 rounded-xl p-4 pb-2 text-left hover:bg-primary/[0.025] sm:gap-4 sm:p-5 sm:pb-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-base font-semibold text-primary sm:size-10">
            {number}
            <span className="sr-only">. </span>
          </span>
          <span className="min-w-0 flex-1 break-words pt-1 text-[1.0625rem] font-semibold text-foreground leading-6 sm:text-lg sm:leading-7">
            {title}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("mt-2 size-5 shrink-0 text-primary", open && "rotate-180")}
          />
        </button>
      </h2>
      {!open && (
        <div
          aria-hidden="true"
          className="legal-preview break-words pb-4 pl-16 pr-4 text-[0.9375rem] leading-6 text-muted-foreground sm:pb-5 sm:pl-19 sm:pr-5 sm:text-base sm:leading-7"
        >
          <div className="line-clamp-2">{children}</div>
        </div>
      )}
      <div
        id={`${id}-body`}
        aria-labelledby={`${id}-heading`}
        hidden={!open}
        className="legal-body break-words pb-4 pl-16 pr-4 text-[0.9375rem] leading-6 text-muted-foreground sm:pb-5 sm:pl-19 sm:pr-5 sm:text-base sm:leading-7"
      >
        {children}
      </div>
    </section>
  );
}
