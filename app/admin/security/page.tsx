import type { Metadata } from "next";
import { AdminMfaSecurity } from "@/components/admin/admin-mfa-security";
import { getAdminMfaSecurityStatus } from "@/features/admin/security-server";
import { PlatformAdminAuthorizationError } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin security | My Kustomers",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AdminSecurityPage() {
  let status;
  try {
    status = await getAdminMfaSecurityStatus();
  } catch (error) {
    if (error instanceof PlatformAdminAuthorizationError) return null;
    throw error;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">Account protection</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin security</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Configure and verify the second factor required for privileged platform actions.
        </p>
      </div>
      <AdminMfaSecurity status={status} />
    </div>
  );
}
