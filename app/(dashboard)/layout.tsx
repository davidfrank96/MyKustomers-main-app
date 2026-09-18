import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireVendorWorkspace } from "@/lib/auth/server";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";
import {
  getSafeRedirectPath,
  INTERNAL_REQUEST_PATH_HEADER,
} from "@/lib/security/redirects";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const requestHeaders = await headers();
  const next = getSafeRedirectPath(requestHeaders.get(INTERNAL_REQUEST_PATH_HEADER));
  const { user, businessContext } = await requireVendorWorkspace(next);

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
