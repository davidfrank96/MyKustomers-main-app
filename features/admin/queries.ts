import "server-only";
import { cache } from "react";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { createClient } from "@/lib/supabase/server";
import { parseAdminOverview, type AdminOverview } from "@/features/admin/overview";

export class AdminOverviewUnavailableError extends Error {
  constructor() {
    super("Platform operations data is currently unavailable.");
    this.name = "AdminOverviewUnavailableError";
  }
}

export const getAdminOverview = cache(async function getAdminOverview(): Promise<AdminOverview> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_overview");
  const overview = error ? null : parseAdminOverview(data);

  if (!overview) {
    throw new AdminOverviewUnavailableError();
  }

  return overview;
});
