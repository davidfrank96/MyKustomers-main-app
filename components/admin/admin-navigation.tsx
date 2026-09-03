"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { Route } from "next";
import { cn } from "@/lib/utils/cn";

// Only active-link presentation is client-owned. Identity and data stay on the server.
export function AdminNavigationLink({
  href,
  segment,
  children,
}: {
  href: Route;
  segment: string | null;
  children: ReactNode;
}) {
  const active = useSelectedLayoutSegment() === segment;
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (active)
      linkRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <Link
      href={href}
      ref={linkRef}
      onFocus={(event) =>
        event.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" })
      }
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-2 text-sm font-medium focus-visible:outline-offset-[-4px] xl:min-h-[72px]",
        active
          ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t after:bg-primary"
          : "text-foreground hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}
