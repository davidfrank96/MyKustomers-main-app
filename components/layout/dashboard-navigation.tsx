"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ComponentType } from "react";
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

function DesktopNavigationContent({ item, active }: { item: NavItem; active: boolean }) {
  const { pending } = useLinkStatus();
  const destinationPending = pending && !active;

  return (
    <span
      aria-busy={destinationPending || undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
        destinationPending && "bg-primary/10 text-primary",
      )}
    >
      {destinationPending ? (
        <span className="animate-spin motion-reduce:animate-none" aria-hidden>
          <LoaderCircle className="size-4" />
        </span>
      ) : (
        <item.icon className="size-4" aria-hidden />
      )}
      {item.label}
      <span className="sr-only" aria-live="polite">
        {destinationPending ? `Opening ${item.label}` : ""}
      </span>
    </span>
  );
}

function MobileNavigationContent({ item, active }: { item: NavItem; active: boolean }) {
  const { pending } = useLinkStatus();
  const destinationPending = pending && !active;

  return (
    <span
      aria-busy={destinationPending || undefined}
      className={cn(
        "relative flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground min-[360px]:text-xs",
        "after:absolute after:inset-x-2 after:top-0 after:h-0.5 after:rounded-b-full after:bg-transparent",
        active && "text-primary after:bg-primary",
        destinationPending && "text-primary",
      )}
    >
      {destinationPending ? (
        <span className="animate-spin motion-reduce:animate-none" aria-hidden>
          <LoaderCircle className="size-5" />
        </span>
      ) : (
        <item.icon className="size-[1.15rem] min-[360px]:size-5" aria-hidden />
      )}
      <span className="max-w-full truncate">{item.label}</span>
      <span className="sr-only" aria-live="polite">
        {destinationPending ? `Opening ${item.label}` : ""}
      </span>
    </span>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Vendor navigation">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <DesktopNavigationContent item={item} active={active} />
          </Link>
        );
      })}
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(23,33,29,0.04)] backdrop-blur lg:hidden"
      aria-label="Mobile vendor navigation"
    >
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <MobileNavigationContent item={item} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
