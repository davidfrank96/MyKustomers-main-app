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
    <DashboardShell
      user={{
        email: user.email,
        displayName:
          typeof user.userMetadata.display_name === "string"
            ? user.userMetadata.display_name
            : undefined,
      }}
      businessContext={{
        businesses: businessContext.businesses,
        currentBusiness: businessContext.currentBusiness,
      }}
    >
      {children}
    </DashboardShell>
  );
}
