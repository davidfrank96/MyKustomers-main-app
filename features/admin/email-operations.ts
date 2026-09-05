import { z } from "zod";
import { adminCountSchema } from "@/features/admin/overview";
import {
  getEmailRetryEligibility,
  type EmailRetryEligibility,
} from "@/lib/email/retry-policy";
import type { TransactionalEmailProviderName } from "@/lib/email/types";
import {
  providerDeliveryReasons,
  providerDeliveryStatuses,
  providerDeliverySummarySchema,
  type ProviderDeliverySummary,
} from "@/features/provider-delivery/model";

export const ADMIN_EMAIL_PAGE_SIZE = 20;
export const ADMIN_EMAIL_SEARCH_LIMIT = 80;

export const adminEmailStatuses = [
  "all",
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
] as const;

export const adminEmailEventTypeValues = [
  "BOOKING_CONFIRMATION_REQUESTED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "BOOKING_AMENDMENT_REQUESTED",
  "BOOKING_AMENDMENT_CONFIRMED",
  "BOOKING_ADDON_REQUESTED",
  "BOOKING_ADDON_CONFIRMED",
  "BOOKING_RESCHEDULED",
  "BOOKING_DELIVERED",
] as const;

export const adminEmailEventTypes = ["all", ...adminEmailEventTypeValues] as const;

export const adminEmailRanges = ["today", "7d", "30d"] as const;

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();
const statusSchema = z.enum(["PENDING", "SENDING", "SENT", "FAILED"]);
const eventTypeSchema = z.enum(adminEmailEventTypeValues);
const rangeSchema = z.enum(adminEmailRanges);
const businessSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1).max(160),
    slug: z.string().min(1).max(60),
  })
  .strict();
const bookingSchema = z
  .object({
    id: uuidSchema,
    reference: z.string().min(1).max(32),
    title: z.string().min(1).max(160),
  })
  .strict();

const adminEmailSummarySchema = z
  .object({
    total: adminCountSchema,
    pending: adminCountSchema,
    sending: adminCountSchema,
    sent: adminCountSchema,
    failed: adminCountSchema,
    potentially_stuck: adminCountSchema,
    range: rangeSchema,
    range_start: timestampSchema,
    refreshed_at: timestampSchema,
  })
  .strict();

const adminEmailEventTypeCountSchema = z
  .object({
    event_type: eventTypeSchema,
    count: adminCountSchema,
    failed: adminCountSchema,
  })
  .strict();

const adminEmailSummaryRowSchema = z
  .object({
    id: uuidSchema,
    event_type: eventTypeSchema,
    status: statusSchema,
    business: businessSchema,
    booking: bookingSchema,
    attempt_count: adminCountSchema,
    created_at: timestampSchema,
    last_attempt_at: nullableTimestampSchema,
    sent_at: nullableTimestampSchema,
  })
  .strict();

const adminEmailOperationsPageSchema = z
  .object({
    summary: adminEmailSummarySchema,
    event_types: z.array(adminEmailEventTypeCountSchema),
    items: z.array(adminEmailSummaryRowSchema),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(50),
    total: adminCountSchema,
  })
  .strict();

const adminEmailDeliveryRowSchema = z
  .object({
    email_event_id: uuidSchema,
    delivery: providerDeliverySummarySchema,
  })
  .strict();

const adminEmailProviderHistorySchema = z
  .array(
    z
      .object({
        id: uuidSchema,
        event_type: z.enum(providerDeliveryStatuses).exclude(["UNKNOWN"]),
        provider_event_at: timestampSchema,
        received_at: timestampSchema,
        reason_category: z.enum(providerDeliveryReasons),
      })
      .strict(),
  )
  .max(50);

const adminEmailDeliveryTotalsSchema = z
  .object({
    range: rangeSchema,
    range_start: timestampSchema,
    refreshed_at: timestampSchema,
    external_accepted: adminCountSchema,
    development_operations: adminCountSchema,
    unknown_provider_operations: adminCountSchema,
    brevo_outcomes: z
      .object({
        unknown: adminCountSchema,
        delivered: adminCountSchema,
        deferred: adminCountSchema,
        soft_bounced: adminCountSchema,
        hard_bounced: adminCountSchema,
        invalid: adminCountSchema,
        blocked: adminCountSchema,
        complaint: adminCountSchema,
        provider_error: adminCountSchema,
      })
      .strict(),
  })
  .strict();

const failureCategorySchema = z.enum([
  "provider_rejected",
  "configuration_error",
  "temporary_provider_failure",
  "invalid_recipient",
  "rate_limited",
  "ambiguous_outcome",
  "unknown_failure",
]);
const deliveryAttemptSchema = z
  .object({
    attempt_number: adminCountSchema,
    provider: z.enum(["development", "brevo", "resend", "unknown"]),
    origin: z.enum(["DOMAIN_EVENT", "ADMIN_RETRY"]),
    status: z.enum(["SENDING", "SENT", "FAILED"]),
    started_at: timestampSchema,
    completed_at: nullableTimestampSchema,
    failure_category: failureCategorySchema.nullable(),
    retry_failure_code: z.string().min(1).max(80).nullable(),
  })
  .strict();

const adminEmailEventDetailSourceSchema = adminEmailSummaryRowSchema
  .extend({
    recipient_masked: z.string().max(254).nullable(),
    failure_category: failureCategorySchema.nullable(),
    retry_failure_code: z.string().min(1).max(80).nullable(),
    delivery_attempts: z.array(deliveryAttemptSchema).max(20),
  })
  .strict();

export type AdminEmailStatus = (typeof adminEmailStatuses)[number];
export type AdminEmailEventType = (typeof adminEmailEventTypes)[number];
export type AdminEmailRange = (typeof adminEmailRanges)[number];
export type AdminEmailSummary = z.infer<typeof adminEmailSummarySchema>;
export type AdminEmailEventSummary = z.infer<typeof adminEmailSummaryRowSchema> & {
  development_adapter?: boolean;
  provider_delivery?: ProviderDeliverySummary;
};
type AdminEmailEventDetailSource = z.infer<typeof adminEmailEventDetailSourceSchema>;
export type AdminEmailDeliveryAttempt = Omit<
  z.infer<typeof deliveryAttemptSchema>,
  "retry_failure_code"
>;
export type AdminEmailEventDetail = Omit<
  AdminEmailEventDetailSource,
  "retry_failure_code" | "delivery_attempts"
> & {
  development_adapter?: boolean;
  provider_delivery?: ProviderDeliverySummary;
  provider_history?: z.infer<typeof adminEmailProviderHistorySchema>;
  delivery_attempts: AdminEmailDeliveryAttempt[];
  retry_eligibility: EmailRetryEligibility;
};
export type AdminEmailOperationsPage = Omit<
  z.infer<typeof adminEmailOperationsPageSchema>,
  "items"
> & {
  items: AdminEmailEventSummary[];
  totalPages: number;
  provider_delivery_totals?: z.infer<typeof adminEmailDeliveryTotalsSchema>;
};
export type AdminEmailDeliveryConfiguration = {
  status: "development" | "configured" | "incomplete";
  provider: string;
  label: string;
  description: string;
};
export type AdminEmailDirectoryParams = {
  page: number;
  q: string;
  status: AdminEmailStatus;
  eventType: AdminEmailEventType;
  range: AdminEmailRange;
  businessId?: string;
  bookingId?: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = value && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseUuid(value: string | undefined) {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseAdminEmailParams(
  value: Record<string, string | string[] | undefined>,
): AdminEmailDirectoryParams {
  return {
    page: parsePage(firstValue(value.page)),
    q: (firstValue(value.q) ?? "").trim().slice(0, ADMIN_EMAIL_SEARCH_LIMIT),
    status: z.enum(adminEmailStatuses).catch("all").parse(firstValue(value.status)),
    eventType: z
      .enum(adminEmailEventTypes)
      .catch("all")
      .parse(firstValue(value.eventType)),
    range: rangeSchema.catch("7d").parse(firstValue(value.range)),
    businessId: parseUuid(firstValue(value.business)),
    bookingId: parseUuid(firstValue(value.booking)),
  };
}

export function parseAdminEmailOperationsPage(
  value: unknown,
): AdminEmailOperationsPage | null {
  const result = adminEmailOperationsPageSchema.safeParse(value);
  if (!result.success) return null;

  return {
    ...result.data,
    totalPages: Math.max(1, Math.ceil(result.data.total / result.data.page_size)),
  };
}

export function parseAdminEmailDeliveryRows(value: unknown) {
  const result = z.array(adminEmailDeliveryRowSchema).max(20).safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminEmailDeliveryTotals(value: unknown) {
  const result = adminEmailDeliveryTotalsSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminEmailProviderHistory(value: unknown) {
  const result = adminEmailProviderHistorySchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminEmailEventDetail(
  value: unknown,
  isProviderConfigured: (provider: TransactionalEmailProviderName) => boolean = () =>
    false,
): AdminEmailEventDetail | null {
  const result = adminEmailEventDetailSourceSchema.safeParse(value);
  if (!result.success) return null;

  const {
    retry_failure_code: failureCode,
    delivery_attempts: attempts,
    ...detail
  } = result.data;
  const latestAttempt = attempts[0] ?? null;
  const retryEligibility = getEmailRetryEligibility({
    status: detail.status,
    eventType: detail.event_type,
    attemptCount: detail.attempt_count,
    failureCode,
    latestAttempt: latestAttempt
      ? {
          attemptNumber: latestAttempt.attempt_number,
          provider: latestAttempt.provider,
          status: latestAttempt.status,
          failureCode: latestAttempt.retry_failure_code,
        }
      : null,
    isProviderConfigured,
  });

  return {
    ...detail,
    delivery_attempts: attempts.map((attempt) => ({
      attempt_number: attempt.attempt_number,
      provider: attempt.provider,
      origin: attempt.origin,
      status: attempt.status,
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      failure_category: attempt.failure_category,
    })),
    retry_eligibility: retryEligibility,
  };
}

export function getAdminEmailHealth(summary: AdminEmailSummary) {
  if (summary.failed > 0) {
    return {
      status: "Attention",
      description: `${summary.failed.toLocaleString("en")} failed event${summary.failed === 1 ? "" : "s"} in the selected period.`,
    };
  }
  if (summary.potentially_stuck > 0) {
    return {
      status: "Backlog",
      description: `${summary.potentially_stuck.toLocaleString("en")} pending or sending event${summary.potentially_stuck === 1 ? "" : "s"} older than 15 minutes.`,
    };
  }
  return {
    status: "Healthy",
    description: "No failed or potentially stuck events in the selected period.",
  };
}

export function formatEmailFailureCategory(value: string | null) {
  if (!value) return "No failure recorded";
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function describeAdminEmailDeliveryConfiguration(selection: {
  label: string;
  external: boolean;
  configured: boolean;
}): AdminEmailDeliveryConfiguration {
  if (!selection.external) {
    return {
      status: "development",
      provider: selection.label,
      label: "Outbox active — external delivery not configured",
      description:
        "Sent means the configured development adapter accepted the event; it does not mean recipient delivery.",
    };
  }

  if (selection.configured) {
    return {
      status: "configured",
      provider: selection.label,
      label: `External delivery configured — ${selection.label}`,
      description:
        "Sent records provider acceptance. Delivery callbacks report recipient outcomes separately; opening and reading are not tracked.",
    };
  }

  return {
    status: "incomplete",
    provider: selection.label,
    label: "External delivery unavailable — provider configuration incomplete",
    description:
      "The selected external provider is missing required server-only configuration.",
  };
}
