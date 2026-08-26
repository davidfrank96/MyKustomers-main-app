import type { Metadata } from "next";
import { AdminSecurityHealth } from "@/components/admin/admin-security-health";
import {
  getAdminHealthSummary,
  getAdminRuntimeConfiguration,
  getAdminSecurityActivity,
} from "@/features/admin/health-server";
import { getAdminMfaSecurityStatus } from "@/features/admin/security-server";
import { requirePlatformAdmin } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security & health | My Kustomers",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AdminSecurityPage() {
  const admin = await requirePlatformAdmin();
  const configuration = getAdminRuntimeConfiguration();
  const [summaryResult, activityResult, mfaResult] = await Promise.allSettled([
    getAdminHealthSummary(),
    getAdminSecurityActivity(),
    getAdminMfaSecurityStatus(),
  ]);

  return (
    <AdminSecurityHealth
      admin={admin}
      summary={summaryResult.status === "fulfilled" ? summaryResult.value : null}
      activity={activityResult.status === "fulfilled" ? activityResult.value : null}
      mfa={mfaResult.status === "fulfilled" ? mfaResult.value : null}
      configuration={configuration}
    />
  );
}
