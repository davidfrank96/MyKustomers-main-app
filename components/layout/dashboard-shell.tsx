import Link from "next/link";
import type { Route } from "next";
import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Home,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import type { BusinessContext, AuthenticatedUser } from "@/lib/auth/server";

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

type DashboardShellProps = {
  children: ReactNode;
  user: AuthenticatedUser;
  businessContext: BusinessContext;
};

function getInitials(user: AuthenticatedUser) {
  const name =
    typeof user.userMetadata.display_name === "string"
      ? user.userMetadata.display_name
      : user.email;

  if (!name) {
    return "MC";
  }

  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardShell({
  children,
  user,
  businessContext,
}: DashboardShellProps) {
  const workspaceLabel = businessContext.currentBusiness?.name ?? "No business selected";

  return (
    <div className="min-h-dvh bg-background pb-20 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            MC
          </span>
          <span className="font-semibold">My Customers</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Vendor navigation">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" aria-hidden={true} />
              {item.label}
            </Link>
          ))}
          <Link
            href={"/settings" as Route}
            className="mt-auto flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4" aria-hidden={true} />
            Settings
          </Link>
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-3" aria-label="My Customers home">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                MC
              </span>
              <span className="font-semibold">My Customers</span>
            </Link>
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm font-medium text-muted-foreground" title={workspaceLabel}>
              {workspaceLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <form action={logoutAction} className="hidden sm:block">
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </Button>
            </form>
            <Avatar aria-label="Signed-in user">
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {children}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Mobile vendor navigation"
      >
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <item.icon className="size-5" aria-hidden={true} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
