import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireVendorWorkspace } from "@/lib/auth/server";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, businessContext } = await requireVendorWorkspace("/dashboard");

  return (
    <DashboardShell user={user} businessContext={businessContext}>
      {children}
    </DashboardShell>
  );
}
