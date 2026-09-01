import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireVendorWorkspace } from "@/lib/auth/server";

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
