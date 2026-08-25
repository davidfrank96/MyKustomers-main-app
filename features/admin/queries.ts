import "server-only";
import { cache } from "react";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { createClient } from "@/lib/supabase/server";
import { parseAdminOverview, type AdminOverview } from "@/features/admin/overview";
import {
  ADMIN_DIRECTORY_PAGE_SIZE,
  parseAdminBusinessDetail,
  parseAdminBusinessPage,
  parseAdminUserDetail,
  parseAdminUserPage,
  type AdminBusinessDetail,
  type AdminBusinessPage,
  type AdminDirectoryParams,
  type AdminUserDetail,
  type AdminUserPage,
} from "@/features/admin/directory";

export class AdminOverviewUnavailableError extends Error {
  constructor() {
    super("Platform operations data is currently unavailable.");
    this.name = "AdminOverviewUnavailableError";
  }
}

export class AdminDirectoryUnavailableError extends Error {
  constructor() {
    super("Platform support data is currently unavailable.");
    this.name = "AdminDirectoryUnavailableError";
  }
}

export const getAdminOverview = cache(
  async function getAdminOverview(): Promise<AdminOverview> {
    await requirePlatformAdmin();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_platform_admin_overview");
    const overview = error ? null : parseAdminOverview(data);

    if (!overview) {
      throw new AdminOverviewUnavailableError();
    }

    return overview;
  },
);

export async function listAdminBusinesses(
  params: AdminDirectoryParams,
): Promise<AdminBusinessPage> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_businesses", {
    p_search: params.q || null,
    p_page: params.page,
    p_page_size: ADMIN_DIRECTORY_PAGE_SIZE,
  });
  const result = error ? null : parseAdminBusinessPage(data);

  if (!result) throw new AdminDirectoryUnavailableError();
  return result;
}

export const getAdminBusiness = cache(async function getAdminBusiness(
  businessId: string,
): Promise<AdminBusinessDetail | null> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_business", {
    p_business_id: businessId,
  });

  if (error) throw new AdminDirectoryUnavailableError();
  if (data === null) return null;

  const result = parseAdminBusinessDetail(data);
  if (!result) throw new AdminDirectoryUnavailableError();
  return result;
});

export async function listAdminUsers(
  params: AdminDirectoryParams,
): Promise<AdminUserPage> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_users", {
    p_search: params.q || null,
    p_page: params.page,
    p_page_size: ADMIN_DIRECTORY_PAGE_SIZE,
  });
  const result = error ? null : parseAdminUserPage(data);

  if (!result) throw new AdminDirectoryUnavailableError();
  return result;
}

export const getAdminUser = cache(async function getAdminUser(
  userId: string,
): Promise<AdminUserDetail | null> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_user", {
    p_user_id: userId,
  });

  if (error) throw new AdminDirectoryUnavailableError();
  if (data === null) return null;

  const result = parseAdminUserDetail(data);
  if (!result) throw new AdminDirectoryUnavailableError();
  return result;
});
