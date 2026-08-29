import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2, LogOut, Plus, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BusinessSwitcher } from "@/components/layout/business-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/dashboard-navigation";
import { PwaReliabilityCoordinator } from "@/components/layout/pwa-reliability-coordinator";
import type { BusinessContext, AuthenticatedUser } from "@/lib/auth/server";

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

export function DashboardShell({ children, user, businessContext }: DashboardShellProps) {
  const workspaceLabel = businessContext.currentBusiness?.name ?? "No business selected";

  return (
    <div className="min-h-dvh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            MC
          </span>
          <span className="font-semibold">My Customers</span>
        </div>
        <DesktopNavigation />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[calc(3.75rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-border bg-card/95 px-3 pt-[env(safe-area-inset-top)] shadow-[0_1px_2px_rgba(23,33,29,0.03)] backdrop-blur sm:px-5 lg:h-16 lg:px-10 lg:pt-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <Link
              href="/"
              className="flex items-center gap-3"
              aria-label="My Customers home"
            >
              <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground sm:size-9 sm:text-sm">
                MC
              </span>
              <span className="hidden font-semibold sm:inline">My Customers</span>
            </Link>
            <BusinessSwitcher
              businesses={businessContext.businesses}
              currentBusiness={businessContext.currentBusiness}
            />
          </div>
          <div className="hidden min-w-0 flex-1 items-center lg:flex">
            <BusinessSwitcher
              businesses={businessContext.businesses}
              currentBusiness={businessContext.currentBusiness}
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Open account menu"
                  className="rounded-full"
                >
                  <Avatar aria-hidden="true">
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <div className="min-w-0 px-3 py-2">
                  <p className="truncate text-sm font-medium">{workspaceLabel}</p>
                  {user.email ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={"/settings" as Route} className="gap-2">
                    <Settings className="size-4" aria-hidden="true" />
                    Profile &amp; account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={"/settings#my-businesses" as Route} className="gap-2">
                    <Building2 className="size-4" aria-hidden="true" />
                    My businesses
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={"/business" as Route} className="gap-2">
                    <BriefcaseBusiness className="size-4" aria-hidden="true" />
                    Business profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={"/business/new" as Route} className="gap-2">
                    <Plus className="size-4" aria-hidden="true" />
                    Add another business
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={"/logout" as Route} className="gap-2">
                    <LogOut className="size-4" aria-hidden="true" />
                    Log out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <PwaReliabilityCoordinator />

        {children}
      </div>

      <MobileNavigation />
    </div>
  );
}
