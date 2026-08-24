import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireUser("/dashboard");
  const businessContext = await getCurrentBusinessContext();

  return (
    <DashboardShell user={user} businessContext={businessContext}>
      {children}
    </DashboardShell>
  );
}
