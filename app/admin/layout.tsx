import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  ShieldCheck,
  Mail,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminAccess,
} from "@/lib/admin/access-policy";
import {
  PlatformAdminAuthorizationError,
  requirePlatformAdminRole,
} from "@/lib/admin/server";
import { requireUser } from "@/lib/auth/server";
import { BrandLogo } from "@/components/shared/brand-logo";
import { AdminNavigationLink } from "@/components/admin/admin-navigation";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: ReactNode;
};

function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <section className="w-full max-w-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-destructive">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Not authorized</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your authenticated account does not have active platform administrator access.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to vendor workspace
        </Link>
      </section>
    </main>
  );
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await requireUser("/admin");
  let admin: PlatformAdminAccess;

  try {
    admin = await requirePlatformAdminRole(PLATFORM_ADMIN_ROLES, user);
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError) {
      return <AccessDenied />;
    }

    throw error;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col px-4 sm:px-6 xl:flex-row xl:items-center xl:gap-8 xl:px-8">
          <div className="flex min-w-0 items-center gap-3 py-3 xl:w-[370px] xl:shrink-0 xl:gap-5">
            <BrandLogo variant="horizontal" className="h-11 w-28 sm:w-40" />
            <div className="min-w-0 flex-1 border-l border-border pl-3 xl:pl-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-base font-semibold">Admin</p>
                {admin.role === "SUPER_ADMIN" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-primary">
                    <span className="sr-only">Role: </span>Super Admin
                  </span>
                )}
              </div>
              <p
                className="mt-1 truncate text-xs text-muted-foreground sm:text-sm"
                title={`Signed in as ${user.email ?? "authenticated account"}`}
              >
                Signed in as {user.email ?? "authenticated account"}
              </p>
            </div>
          </div>
          <nav
            aria-label="Admin navigation"
            className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain xl:flex-1 xl:justify-between xl:gap-1"
          >
            <AdminNavigationLink href="/admin" segment={null}>
              <Clock3 className="size-4 shrink-0" aria-hidden="true" />
              Overview
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/businesses" segment="businesses">
              <Building2 className="size-4" aria-hidden="true" />
              Businesses
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/users" segment="users">
              <Users className="size-4" aria-hidden="true" />
              Users
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/bookings" segment="bookings">
              <CalendarDays className="size-4" aria-hidden="true" />
              Bookings
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/issues" segment="issues">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Issues
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/emails" segment="emails">
              <Mail className="size-4" aria-hidden="true" />
              Email Operations
            </AdminNavigationLink>
            <AdminNavigationLink href="/admin/security" segment="security">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Security &amp; Health
            </AdminNavigationLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] min-w-0 px-4 pb-8 sm:px-6 xl:px-10">
        <p className="sr-only">Administrator status: {admin.status}</p>
        <Link
          href="/dashboard"
          className="my-3 inline-flex min-h-11 items-center gap-3 rounded text-sm font-medium text-primary hover:underline sm:my-4"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          Vendor workspace
        </Link>
        {children}
      </main>
    </div>
  );
}
