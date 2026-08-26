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
import {
  ADMIN_OPERATION_PAGE_SIZE,
  parseAdminBookingDetail,
  parseAdminBookingPage,
  parseAdminIssueDetail,
  parseAdminIssuePage,
  type AdminBookingDetail,
  type AdminBookingDirectoryParams,
  type AdminBookingPage,
  type AdminIssueDetail,
  type AdminIssueDirectoryParams,
  type AdminIssuePage,
} from "@/features/admin/operations";
import {
  ADMIN_EMAIL_PAGE_SIZE,
  describeAdminEmailDeliveryConfiguration,
  parseAdminEmailEventDetail,
  parseAdminEmailOperationsPage,
  type AdminEmailDeliveryConfiguration,
  type AdminEmailDirectoryParams,
  type AdminEmailEventDetail,
  type AdminEmailOperationsPage,
} from "@/features/admin/email-operations";
import {
  getTransactionalEmailProviderSelection,
  getTransactionalEmailProviderSelectionForName,
} from "@/lib/email/provider";

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

export class AdminOperationsUnavailableError extends Error {
  constructor() {
    super("Platform operations data is currently unavailable.");
    this.name = "AdminOperationsUnavailableError";
  }
}

export class AdminEmailOperationsUnavailableError extends Error {
  constructor() {
    super("Platform email operations data is currently unavailable.");
    this.name = "AdminEmailOperationsUnavailableError";
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

export async function listAdminBookings(
  params: AdminBookingDirectoryParams,
): Promise<AdminBookingPage> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_bookings", {
    p_search: params.q || null,
    p_filter: params.filter,
    p_business_id: params.businessId ?? null,
    p_page: params.page,
    p_page_size: ADMIN_OPERATION_PAGE_SIZE,
  });
  const result = error ? null : parseAdminBookingPage(data);

  if (!result) throw new AdminOperationsUnavailableError();
  return result;
}

export const getAdminBooking = cache(async function getAdminBooking(
  bookingId: string,
): Promise<AdminBookingDetail | null> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_booking", {
    p_booking_id: bookingId,
  });

  if (error) throw new AdminOperationsUnavailableError();
  if (data === null) return null;

  const result = parseAdminBookingDetail(data);
  if (!result) throw new AdminOperationsUnavailableError();
  return result;
});

export async function listAdminIssues(
  params: AdminIssueDirectoryParams,
): Promise<AdminIssuePage> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_issues", {
    p_search: params.q || null,
    p_status: params.status,
    p_category: params.category,
    p_business_id: params.businessId ?? null,
    p_page: params.page,
    p_page_size: ADMIN_OPERATION_PAGE_SIZE,
  });
  const result = error ? null : parseAdminIssuePage(data);

  if (!result) throw new AdminOperationsUnavailableError();
  return result;
}

export const getAdminIssue = cache(async function getAdminIssue(
  issueId: string,
): Promise<AdminIssueDetail | null> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_issue", {
    p_issue_id: issueId,
  });

  if (error) throw new AdminOperationsUnavailableError();
  if (data === null) return null;

  const result = parseAdminIssueDetail(data);
  if (!result) throw new AdminOperationsUnavailableError();
  return result;
});

export async function listAdminEmailOperations(
  params: AdminEmailDirectoryParams,
): Promise<AdminEmailOperationsPage> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_email_operations", {
    p_search: params.q || null,
    p_status: params.status,
    p_event_type: params.eventType,
    p_range: params.range,
    p_business_id: params.businessId ?? null,
    p_booking_id: params.bookingId ?? null,
    p_page: params.page,
    p_page_size: ADMIN_EMAIL_PAGE_SIZE,
  });
  const result = error ? null : parseAdminEmailOperationsPage(data);

  if (!result) throw new AdminEmailOperationsUnavailableError();
  return result;
}

export const getAdminEmailEvent = cache(async function getAdminEmailEvent(
  emailEventId: string,
): Promise<AdminEmailEventDetail | null> {
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_admin_email_event", {
    p_email_event_id: emailEventId,
  });

  if (error) throw new AdminEmailOperationsUnavailableError();
  if (data === null) return null;

  const result = parseAdminEmailEventDetail(
    data,
    (provider) => getTransactionalEmailProviderSelectionForName(provider).configured,
  );
  if (!result) throw new AdminEmailOperationsUnavailableError();
  return result;
});

export function getAdminEmailDeliveryConfiguration(): AdminEmailDeliveryConfiguration {
  return describeAdminEmailDeliveryConfiguration(
    getTransactionalEmailProviderSelection(),
  );
}
