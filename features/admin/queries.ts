import "server-only";
import { cache } from "react";
import { requirePlatformAdmin } from "@/lib/admin/server";
import { findDevelopmentAdapterEvents } from "./development-email-evidence";
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
  parseAdminEmailDeliveryRows,
  parseAdminEmailDeliveryTotals,
  parseAdminEmailEventDetail,
  parseAdminEmailProviderHistory,
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
  const eventIds = result.items.map((item) => item.id);
  const developmentEvidence = findDevelopmentAdapterEvents(
    result.items.map((item) => item.id),
  );
  const [development, deliveryResponse, totalsResponse] = await Promise.all([
    developmentEvidence,
    supabase.rpc("get_platform_admin_email_delivery", {
      p_email_event_ids: eventIds,
    }),
    supabase.rpc("get_platform_admin_email_delivery_totals", {
      p_range: params.range,
    }),
  ]);
  const deliveryRows = deliveryResponse.error
    ? null
    : parseAdminEmailDeliveryRows(deliveryResponse.data);
  const deliveryTotals = totalsResponse.error
    ? null
    : parseAdminEmailDeliveryTotals(totalsResponse.data);
  if (!deliveryRows || !deliveryTotals) {
    throw new AdminEmailOperationsUnavailableError();
  }
  const deliveryByEvent = new Map(
    deliveryRows.map((row) => [row.email_event_id, row.delivery]),
  );
  return {
    ...result,
    provider_delivery_totals: deliveryTotals,
    items: result.items.map((item) => ({
      ...item,
      provider_delivery: deliveryByEvent.get(item.id),
      development_adapter:
        deliveryByEvent.get(item.id)?.development_adapter ?? development.has(item.id),
    })),
  };
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
  const [development, deliveryResponse, historyResponse] = await Promise.all([
    findDevelopmentAdapterEvents([result.id]),
    supabase.rpc("get_platform_admin_email_delivery", {
      p_email_event_ids: [result.id],
    }),
    supabase.rpc("get_platform_admin_email_provider_history", {
      p_email_event_id: result.id,
      p_before: null,
      p_before_id: null,
    }),
  ]);
  const deliveryRows = deliveryResponse.error
    ? null
    : parseAdminEmailDeliveryRows(deliveryResponse.data);
  const providerHistory = historyResponse.error
    ? null
    : parseAdminEmailProviderHistory(historyResponse.data);
  if (!deliveryRows || !providerHistory) {
    throw new AdminEmailOperationsUnavailableError();
  }
  const providerDelivery = deliveryRows[0]?.delivery;
  return {
    ...result,
    provider_delivery: providerDelivery,
    provider_history: providerHistory,
    development_adapter:
      providerDelivery?.development_adapter ||
      development.has(result.id) ||
      result.delivery_attempts[0]?.provider === "development",
  };
});

export function getAdminEmailDeliveryConfiguration(): AdminEmailDeliveryConfiguration {
  return describeAdminEmailDeliveryConfiguration(
    getTransactionalEmailProviderSelection(),
  );
}
