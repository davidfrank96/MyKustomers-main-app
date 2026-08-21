import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/dashboard-navigation";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
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

export function DashboardShell({
  children,
  user,
  businessContext,
}: DashboardShellProps) {
  const workspaceLabel = businessContext.currentBusiness?.name ?? "No business selected";
  const workspaceLogoUrl = getBusinessLogoPublicUrl(
    businessContext.currentBusiness?.logoPath,
  );

  return (
    <div className="min-h-dvh bg-background pb-20 lg:pb-0">
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-3" aria-label="My Customers home">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                MC
              </span>
              <span className="font-semibold">My Customers</span>
            </Link>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
            <BusinessLogo
              name={workspaceLabel}
              url={workspaceLogoUrl}
              className="size-8"
            />
            <p className="truncate text-sm font-medium text-muted-foreground" title={workspaceLabel}>
              {workspaceLabel}
            </p>
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
                    <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={"/settings" as Route} className="gap-2">
                    <Settings className="size-4" aria-hidden="true" />
                    Settings
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

        {children}
      </div>

      <MobileNavigation />
    </div>
  );
}
