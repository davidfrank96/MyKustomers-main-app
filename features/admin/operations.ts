import { z } from "zod";
import { adminCountSchema } from "@/features/admin/overview";

export const ADMIN_OPERATION_PAGE_SIZE = 20;
export const ADMIN_OPERATION_SEARCH_LIMIT = 80;

export const adminBookingFilters = [
  "all",
  "active",
  "draft",
  "awaiting_customer",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
  "completed",
  "cancelled",
  "due_today",
  "overdue",
] as const;

export const adminIssueStatuses = ["all", "OPEN", "RESOLVED"] as const;
export const adminIssueCategories = [
  "all",
  "LATE_DELIVERY",
  "CUSTOMER_REQUESTED_CHANGE",
  "PRODUCT_DAMAGED",
  "COMMUNICATION_ISSUE",
  "PAYMENT_BALANCE_ISSUE",
  "NO_SHOW",
  "OTHER",
] as const;

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();
const moneySchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const shortTextSchema = z.string().max(500);
const bookingStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);
const currencySchema = z.enum(["NGN", "EUR", "GBP", "USD"]);
const issueCategorySchema = z.enum([
  "LATE_DELIVERY",
  "CUSTOMER_REQUESTED_CHANGE",
  "PRODUCT_DAMAGED",
  "COMMUNICATION_ISSUE",
  "PAYMENT_BALANCE_ISSUE",
  "NO_SHOW",
  "OTHER",
]);
const issueStatusSchema = z.enum(["OPEN", "RESOLVED"]);
const identitySchema = z
  .object({
    id: uuidSchema,
    display_name: z.string().max(120).nullable(),
    email: z.string().email().max(254).nullable(),
  })
  .strict();
const businessSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1).max(160),
    slug: z.string().min(1).max(60),
  })
  .strict();
const bookingReferenceSchema = z
  .object({
    id: uuidSchema,
    reference: z.string().min(1).max(32),
    title: z.string().min(1).max(160),
  })
  .strict();

const adminBookingSummarySchema = z
  .object({
    id: uuidSchema,
    reference: z.string().min(1).max(32),
    title: z.string().min(1).max(160),
    business: businessSchema,
    customer_name: z.string().min(1).max(160),
    status: bookingStatusSchema,
    scheduled_for: nullableTimestampSchema,
    currency: currencySchema,
    effective_total_amount_minor: moneySchema,
    created_at: timestampSchema,
    open_issue_count: adminCountSchema,
  })
  .strict();

const adminBookingPageSchema = z
  .object({
    items: z.array(adminBookingSummarySchema),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(50),
    total: adminCountSchema,
  })
  .strict();

const confirmationTermsSchema = z
  .object({
    title: z.string().max(160).optional(),
    scheduled_for: z.string().max(64).optional(),
    currency: currencySchema.optional(),
    total_amount_minor: moneySchema.optional(),
    deposit_amount_minor: moneySchema.optional(),
  })
  .strict();

const adminBookingDetailSchema = z
  .object({
    id: uuidSchema,
    reference: z.string().min(1).max(32),
    title: z.string().min(1).max(160),
    status: bookingStatusSchema,
    business: businessSchema,
    customer: z.object({ name: z.string().min(1).max(160) }).strict(),
    creator: identitySchema,
    created_at: timestampSchema,
    scheduled_for: nullableTimestampSchema,
    currency: currencySchema,
    canonical_total_amount_minor: moneySchema,
    canonical_deposit_amount_minor: moneySchema,
    effective_total_amount_minor: moneySchema,
    effective_deposit_amount_minor: moneySchema,
    started_at: nullableTimestampSchema,
    ready_at: nullableTimestampSchema,
    delivered_at: nullableTimestampSchema,
    completed_at: nullableTimestampSchema,
    cancelled_at: nullableTimestampSchema,
    cancellation_reason: z.string().max(500).nullable(),
    confirmation: z
      .object({
        state: z.enum([
          "never_sent",
          "awaiting_customer",
          "confirmed",
          "invalidated",
          "cancelled",
        ]),
        confirmed_at: nullableTimestampSchema,
        contact_email_masked: z.string().max(254).nullable(),
        contact_phone_masked: z.string().max(16).nullable(),
        terms: confirmationTermsSchema.nullable(),
      })
      .strict(),
    amendments: z.array(
      z
        .object({
          id: uuidSchema,
          status: z.enum(["PENDING_CUSTOMER", "CONFIRMED", "REVOKED"]),
          reason: shortTextSchema,
          changed_fields: z.array(z.string().max(40)).max(6),
          created_at: timestampSchema,
          submitted_at: timestampSchema,
          first_opened_at: nullableTimestampSchema,
          confirmed_at: nullableTimestampSchema,
          revoked_at: nullableTimestampSchema,
          revoked_reason: shortTextSchema.nullable(),
        })
        .strict(),
    ),
    addons: z.array(
      z
        .object({
          id: uuidSchema,
          title: z.string().min(1).max(160),
          status: z.enum(["DRAFT", "AWAITING_CUSTOMER", "CONFIRMED", "CANCELLED"]),
          currency: currencySchema,
          total_amount_minor: moneySchema,
          deposit_amount_minor: moneySchema,
          created_at: timestampSchema,
          submitted_at: nullableTimestampSchema,
          confirmed_at: nullableTimestampSchema,
          cancelled_at: nullableTimestampSchema,
          cancellation_reason: z.string().max(80).nullable(),
        })
        .strict(),
    ),
    status_history: z.array(
      z
        .object({
          from_status: bookingStatusSchema.nullable(),
          to_status: bookingStatusSchema,
          changed_at: timestampSchema,
        })
        .strict(),
    ),
    changes: z.array(
      z
        .object({
          change_type: z.enum(["reschedule", "amendment"]),
          previous_scheduled_for: nullableTimestampSchema,
          new_scheduled_for: nullableTimestampSchema,
          changed_fields: z.array(z.string().max(40)).max(6).nullable(),
          created_at: timestampSchema,
        })
        .strict(),
    ),
    feedback: z
      .object({
        overall_rating: z.number().int().min(1).max(5),
        on_time: z.boolean(),
        met_expectations: z.boolean(),
        submitted_at: timestampSchema,
      })
      .strict()
      .nullable(),
    issues: z.array(
      z
        .object({
          id: uuidSchema,
          category: issueCategorySchema,
          status: issueStatusSchema,
          created_at: timestampSchema,
          resolved_at: nullableTimestampSchema,
        })
        .strict(),
    ),
    email_summary: z.array(
      z
        .object({
          event_type: z.enum([
            "BOOKING_CONFIRMED",
            "BOOKING_CANCELLED",
            "BOOKING_AMENDMENT_REQUESTED",
            "BOOKING_AMENDMENT_CONFIRMED",
            "BOOKING_ADDON_REQUESTED",
            "BOOKING_ADDON_CONFIRMED",
            "BOOKING_RESCHEDULED",
            "BOOKING_DELIVERED",
          ]),
          status: z.enum(["PENDING", "SENDING", "SENT", "FAILED"]),
          count: adminCountSchema,
        })
        .strict(),
    ),
  })
  .strict();

const adminIssueSummarySchema = z
  .object({
    id: uuidSchema,
    category: issueCategorySchema,
    status: issueStatusSchema,
    business: businessSchema,
    booking: bookingReferenceSchema,
    created_at: timestampSchema,
    resolved_at: nullableTimestampSchema,
  })
  .strict();

const adminIssuePageSchema = z
  .object({
    items: z.array(adminIssueSummarySchema),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(50),
    total: adminCountSchema,
  })
  .strict();

const adminIssueDetailSchema = adminIssueSummarySchema
  .omit({ booking: true })
  .extend({
    description: z.string().min(1).max(5000),
    booking: bookingReferenceSchema.extend({ status: bookingStatusSchema }).strict(),
    creator: identitySchema,
    resolver: identitySchema.nullable(),
  })
  .strict();

export type AdminBookingFilter = (typeof adminBookingFilters)[number];
export type AdminIssueStatus = (typeof adminIssueStatuses)[number];
export type AdminIssueCategory = (typeof adminIssueCategories)[number];
export type AdminBookingSummary = z.infer<typeof adminBookingSummarySchema>;
export type AdminBookingDetail = z.infer<typeof adminBookingDetailSchema>;
export type AdminIssueSummary = z.infer<typeof adminIssueSummarySchema>;
export type AdminIssueDetail = z.infer<typeof adminIssueDetailSchema>;
export type AdminBookingPage = z.infer<typeof adminBookingPageSchema> & {
  totalPages: number;
};
export type AdminIssuePage = z.infer<typeof adminIssuePageSchema> & {
  totalPages: number;
};
export type AdminBookingDirectoryParams = {
  page: number;
  q: string;
  filter: AdminBookingFilter;
  businessId?: string;
};
export type AdminIssueDirectoryParams = {
  page: number;
  q: string;
  status: AdminIssueStatus;
  category: AdminIssueCategory;
  businessId?: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = value && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseBusinessId(value: string | undefined) {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseSearch(value: string | undefined) {
  return (value ?? "").trim().slice(0, ADMIN_OPERATION_SEARCH_LIMIT);
}

export function parseAdminBookingParams(
  value: Record<string, string | string[] | undefined>,
): AdminBookingDirectoryParams {
  const filter = z.enum(adminBookingFilters).catch("all").parse(firstValue(value.filter));
  return {
    page: parsePage(firstValue(value.page)),
    q: parseSearch(firstValue(value.q)),
    filter,
    businessId: parseBusinessId(firstValue(value.business)),
  };
}

export function parseAdminIssueParams(
  value: Record<string, string | string[] | undefined>,
): AdminIssueDirectoryParams {
  const status = z.enum(adminIssueStatuses).catch("all").parse(firstValue(value.status));
  const category = z
    .enum(adminIssueCategories)
    .catch("all")
    .parse(firstValue(value.category));
  return {
    page: parsePage(firstValue(value.page)),
    q: parseSearch(firstValue(value.q)),
    status,
    category,
    businessId: parseBusinessId(firstValue(value.business)),
  };
}

function withTotalPages<T extends { page_size: number; total: number }>(value: T) {
  return {
    ...value,
    totalPages: Math.max(1, Math.ceil(value.total / value.page_size)),
  };
}

export function parseAdminBookingPage(value: unknown): AdminBookingPage | null {
  const result = adminBookingPageSchema.safeParse(value);
  return result.success ? withTotalPages(result.data) : null;
}

export function parseAdminBookingDetail(value: unknown): AdminBookingDetail | null {
  const result = adminBookingDetailSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminIssuePage(value: unknown): AdminIssuePage | null {
  const result = adminIssuePageSchema.safeParse(value);
  return result.success ? withTotalPages(result.data) : null;
}

export function parseAdminIssueDetail(value: unknown): AdminIssueDetail | null {
  const result = adminIssueDetailSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function formatOperationLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
