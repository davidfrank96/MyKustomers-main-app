"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState, type ComponentType, type MouseEvent } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Home,
  LoaderCircle,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  label: string;
  href: Route;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Bookings", href: "/bookings" as Route, icon: CalendarDays },
  { label: "Customers", href: "/customers" as Route, icon: Users },
  { label: "Insights", href: "/insights" as Route, icon: BarChart3 },
  { label: "Business", href: "/business" as Route, icon: BriefcaseBusiness },
];

function isActive(pathname: string, href: Route) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function usePendingDestination(pathname: string) {
  const [pendingHref, setPendingHref] = useState<Route | null>(null);

  useEffect(() => {
    if (!pendingHref || isActive(pathname, pendingHref)) return;
    const timeout = window.setTimeout(() => setPendingHref(null), 15_000);
    return () => window.clearTimeout(timeout);
  }, [pathname, pendingHref]);

  return [pendingHref, setPendingHref] as const;
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = usePendingDestination(pathname);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Vendor navigation">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const pending = pendingHref === item.href && !active;

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-busy={pending || undefined}
            onClick={(event) => {
              if (!shouldHandleNavigation(event) || active) return;
              if (pending) {
                event.preventDefault();
                return;
              }
              setPendingHref(item.href);
            }}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
              pending && "bg-primary/10 text-primary",
            )}
          >
            {pending ? (
              <span className="animate-spin motion-reduce:animate-none" aria-hidden>
                <LoaderCircle className="size-4" />
              </span>
            ) : (
              <item.icon className="size-4" aria-hidden />
            )}
            {item.label}
          </Link>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {pendingHref && !isActive(pathname, pendingHref)
          ? `Opening ${navItems.find((item) => item.href === pendingHref)?.label ?? "page"}`
          : ""}
      </span>
      <Link
        href={"/settings" as Route}
        aria-current={isActive(pathname, "/settings" as Route) ? "page" : undefined}
        className={cn(
          "mt-auto flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
          isActive(pathname, "/settings" as Route) && "bg-muted text-foreground",
        )}
      >
        <Settings className="size-4" aria-hidden={true} />
        Settings
      </Link>
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = usePendingDestination(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile vendor navigation"
    >
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const pending = pendingHref === item.href && !active;

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-busy={pending || undefined}
            onClick={(event) => {
              if (!shouldHandleNavigation(event) || active) return;
              if (pending) {
                event.preventDefault();
                return;
              }
              setPendingHref(item.href);
            }}
            className={cn(
              "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              active && "text-foreground",
              pending && "text-primary",
            )}
          >
            {pending ? (
              <span className="animate-spin motion-reduce:animate-none" aria-hidden>
                <LoaderCircle className="size-5" />
              </span>
            ) : (
              <item.icon className="size-5" aria-hidden />
            )}
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {pendingHref && !isActive(pathname, pendingHref)
          ? `Opening ${navItems.find((item) => item.href === pendingHref)?.label ?? "page"}`
          : ""}
      </span>
    </nav>
  );
}
