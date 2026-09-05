import {
  adminEmailEventTypeValues,
  describeAdminEmailDeliveryConfiguration,
  type AdminEmailOperationsPage,
} from "@/features/admin/email-operations";

export const emailStates = [
  "healthy",
  "attention",
  "backlog",
  "active",
  "empty",
  "loading",
  "searching",
  "stress",
] as const;
export type EmailState = (typeof emailStates)[number];
export function emailFixture(state: EmailState = "healthy") {
  const result: AdminEmailOperationsPage = {
    summary: {
      total: 60,
      pending: 0,
      sending: 0,
      sent: 60,
      failed: 0,
      potentially_stuck: 0,
      range: "7d",
      range_start: "2026-08-28T00:00:00Z",
      refreshed_at: "2026-09-04T00:00:00Z",
    },
    event_types: adminEmailEventTypeValues.map((event_type, index) => ({
      event_type,
      count: index === 0 ? 12 : 6,
      failed: 0,
    })),
    items: Array.from({ length: 20 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      status: "SENT",
      event_type: adminEmailEventTypeValues[index % adminEmailEventTypeValues.length],
      booking: {
        id: "00000000-0000-4000-8000-000000000080",
        reference: `MC-260903-${String(index + 1).padStart(6, "0")}`,
        title: "Controlled booking for local review",
      },
      business: {
        id: "00000000-0000-4000-8000-000000000090",
        name: "Review Studio",
        slug: "review-studio",
      },
      attempt_count: index + 1,
      created_at: new Date(Date.UTC(2026, 8, 3, 20, 59 - index)).toISOString(),
      last_attempt_at: null,
      sent_at: null,
    })),
    page: 1,
    page_size: 20,
    total: 60,
    totalPages: 3,
    provider_delivery_totals: {
      range: "7d",
      range_start: "2026-08-28T00:00:00Z",
      refreshed_at: "2026-09-04T00:00:00Z",
      external_accepted: 0,
      development_operations: 60,
      unknown_provider_operations: 0,
      brevo_outcomes: {
        unknown: 0,
        delivered: 0,
        deferred: 0,
        soft_bounced: 0,
        hard_bounced: 0,
        invalid: 0,
        blocked: 0,
        complaint: 0,
        provider_error: 0,
      },
    },
  };
  const delivery = describeAdminEmailDeliveryConfiguration({
    label: "Development",
    external: false,
    configured: true,
  });
  const params: Record<string, string> = {};
  if (state === "attention" || state === "stress") {
    result.summary.pending = 8;
    result.summary.sending = 4;
    result.summary.failed = 8;
    result.summary.sent = 40;
    result.summary.potentially_stuck = 3;
    result.items.forEach((item, index) => {
      item.status = (["PENDING", "SENDING", "SENT", "FAILED"] as const)[index % 4];
    });
    result.event_types[0].failed = 3;
  }
  if (state === "backlog") {
    result.summary.pending = 10;
    result.summary.sent = 50;
    result.summary.potentially_stuck = 2;
  }
  if (state === "active") {
    Object.assign(params, {
      q: "review",
      status: "FAILED",
      eventType: "BOOKING_DELIVERED",
      range: "30d",
      page: "2",
      business: "00000000-0000-4000-8000-000000000090",
    });
    result.page = 2;
    result.summary.range = "30d";
    if (result.provider_delivery_totals) {
      result.provider_delivery_totals.range = "30d";
    }
    result.summary.failed = 60;
    result.summary.sent = 0;
    result.event_types = [{ event_type: "BOOKING_DELIVERED", count: 60, failed: 60 }];
    result.items.forEach((item) => {
      item.status = "FAILED";
      item.event_type = "BOOKING_DELIVERED";
    });
  }
  if (state === "empty") {
    params.q = "no-match";
    result.items = [];
    result.total = 0;
    result.totalPages = 1;
    result.summary.total = 0;
    result.summary.sent = 0;
    result.event_types = [];
  }
  if (state === "searching") params.q = "review";
  if (state === "stress") {
    Object.assign(
      delivery,
      describeAdminEmailDeliveryConfiguration({
        label: "A long synthetic transactional provider label for local layout review",
        external: true,
        configured: false,
      }),
    );
    result.summary.total = 12345;
    result.summary.sent = 12325;
    result.items.forEach((item) => {
      item.booking.reference = "MC-260903-" + "X".repeat(22);
      item.booking.title =
        "A long booking title with precise operational context ".repeat(3);
      item.business.name = "A long business name for responsive review ".repeat(3);
      item.attempt_count = 1234;
    });
  }
  return { result, delivery, params };
}
