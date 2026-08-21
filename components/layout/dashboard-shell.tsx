import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/dashboard-navigation";
import { logoutAction } from "@/features/auth/actions";
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

      <MobileNavigation />
    </div>
  );
}
