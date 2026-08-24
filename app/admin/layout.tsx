import { ArrowLeft, ShieldCheck } from "lucide-react";
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">My Customers Admin</p>
              <p className="truncate text-sm text-muted-foreground">
                Signed in as {user.email ?? "authenticated account"}
              </p>
            </div>
          </div>
          <nav
            aria-label="Admin navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm"
          >
            <span className="font-medium text-foreground">Role: Super Admin</span>
            <Link href="/admin" className="font-medium text-primary">
              Overview
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-medium text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Vendor workspace
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <p className="sr-only">Administrator status: {admin.status}</p>
        {children}
      </main>
    </div>
  );
}
