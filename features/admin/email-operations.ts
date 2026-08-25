import { z } from "zod";
import { adminCountSchema } from "@/features/admin/overview";

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
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "BOOKING_AMENDMENT_REQUESTED",
  "BOOKING_AMENDMENT_CONFIRMED",
  "BOOKING_ADDON_REQUESTED",
  "BOOKING_ADDON_CONFIRMED",
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

const adminEmailEventDetailSchema = adminEmailSummaryRowSchema
  .extend({
    recipient_masked: z.string().max(254).nullable(),
    failure_category: z
      .enum([
        "provider_rejected",
        "configuration_error",
        "temporary_provider_failure",
        "invalid_recipient",
        "rate_limited",
        "unknown_failure",
      ])
      .nullable(),
  })
  .strict();

export type AdminEmailStatus = (typeof adminEmailStatuses)[number];
export type AdminEmailEventType = (typeof adminEmailEventTypes)[number];
export type AdminEmailRange = (typeof adminEmailRanges)[number];
export type AdminEmailSummary = z.infer<typeof adminEmailSummarySchema>;
export type AdminEmailEventSummary = z.infer<typeof adminEmailSummaryRowSchema>;
export type AdminEmailEventDetail = z.infer<typeof adminEmailEventDetailSchema>;
export type AdminEmailOperationsPage = z.infer<typeof adminEmailOperationsPageSchema> & {
  totalPages: number;
};
export type AdminEmailDeliveryConfiguration = {
  status: "development" | "configured" | "incomplete";
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

export function parseAdminEmailEventDetail(value: unknown): AdminEmailEventDetail | null {
  const result = adminEmailEventDetailSchema.safeParse(value);
  return result.success ? result.data : null;
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
