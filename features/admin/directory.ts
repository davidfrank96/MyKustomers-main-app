import { z } from "zod";
import { adminCountSchema } from "@/features/admin/overview";

export const ADMIN_DIRECTORY_PAGE_SIZE = 20;
export const ADMIN_DIRECTORY_SEARCH_LIMIT = 80;

const uuidSchema = z.string().uuid();
const optionalTextSchema = z.string().max(2048).nullable();
const timestampSchema = z.string().datetime({ offset: true });
const providerSchema = z.string().regex(/^[a-z0-9:_-]{1,80}$/);

const adminOwnerSchema = z
  .object({
    user_id: uuidSchema,
    display_name: z.string().max(120).nullable(),
    email: z.string().email().max(254).nullable(),
  })
  .strict();

const adminBusinessSummarySchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1).max(160),
    slug: z.string().min(1).max(60),
    email: z.string().email().max(254).nullable(),
    website: optionalTextSchema,
    logo_path: z.string().max(255).nullable(),
    created_at: timestampSchema,
    owners: z.array(adminOwnerSchema),
    member_count: adminCountSchema,
    customer_count: adminCountSchema,
    booking_count: adminCountSchema,
    active_booking_count: adminCountSchema,
  })
  .strict();

const adminBusinessPageSchema = z
  .object({
    items: z.array(adminBusinessSummarySchema),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(50),
    total: adminCountSchema,
  })
  .strict();

const adminBusinessMembershipSchema = z
  .object({
    user_id: uuidSchema,
    display_name: z.string().max(120).nullable(),
    email: z.string().email().max(254).nullable(),
    role: z.enum(["owner", "member"]),
    status: z.enum(["active"]),
    created_at: timestampSchema,
  })
  .strict();

const adminBusinessMetricsSchema = z
  .object({
    customers: adminCountSchema,
    bookings: adminCountSchema,
    active_bookings: adminCountSchema,
    completed_bookings: adminCountSchema,
    open_issues: adminCountSchema,
    failed_emails: adminCountSchema,
    pending_emails: adminCountSchema,
  })
  .strict();

const adminBusinessDetailSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1).max(160),
    slug: z.string().min(1).max(60),
    category: z.string().min(1).max(120),
    website: optionalTextSchema,
    instagram: z.string().max(30).nullable(),
    email: z.string().email().max(254).nullable(),
    phone: z.string().max(32).nullable(),
    logo_path: z.string().max(255).nullable(),
    created_at: timestampSchema,
    onboarding_completed_at: timestampSchema,
    memberships: z.array(adminBusinessMembershipSchema),
    metrics: adminBusinessMetricsSchema,
  })
  .strict();

const adminUserSummarySchema = z
  .object({
    id: uuidSchema,
    display_name: z.string().max(120).nullable(),
    email: z.string().email().max(254).nullable(),
    providers: z.array(providerSchema),
    membership_count: adminCountSchema,
    created_at: timestampSchema,
  })
  .strict();

const adminUserPageSchema = z
  .object({
    items: z.array(adminUserSummarySchema),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(50),
    total: adminCountSchema,
  })
  .strict();

const adminUserMembershipSchema = z
  .object({
    business_id: uuidSchema,
    business_name: z.string().max(160).nullable(),
    business_slug: z.string().max(60).nullable(),
    role: z.enum(["owner", "member"]),
    status: z.enum(["active"]),
    created_at: timestampSchema,
  })
  .strict();

const platformAdminBadgeSchema = z
  .object({
    role: z.enum(["SUPER_ADMIN"]),
    status: z.enum(["ACTIVE", "DISABLED"]),
  })
  .strict();

const adminUserDetailSchema = z
  .object({
    id: uuidSchema,
    display_name: z.string().max(120).nullable(),
    email: z.string().email().max(254).nullable(),
    created_at: timestampSchema,
    last_sign_in_at: timestampSchema.nullable(),
    email_confirmed_at: timestampSchema.nullable(),
    providers: z.array(providerSchema),
    memberships: z.array(adminUserMembershipSchema),
    platform_admin: platformAdminBadgeSchema.nullable(),
  })
  .strict();

export type AdminDirectoryParams = {
  page: number;
  q: string;
};

export type AdminBusinessSummary = z.infer<typeof adminBusinessSummarySchema>;
export type AdminBusinessDetail = z.infer<typeof adminBusinessDetailSchema>;
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export type AdminBusinessPage = z.infer<typeof adminBusinessPageSchema> & {
  totalPages: number;
};

export type AdminUserPage = z.infer<typeof adminUserPageSchema> & {
  totalPages: number;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminDirectoryParams(
  value: Record<string, string | string[] | undefined>,
): AdminDirectoryParams {
  const q = (firstValue(value.q) ?? "").trim().slice(0, ADMIN_DIRECTORY_SEARCH_LIMIT);
  const rawPage = firstValue(value.page) ?? "1";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    q,
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function withTotalPages<T extends { page_size: number; total: number }>(value: T) {
  return {
    ...value,
    totalPages: Math.max(1, Math.ceil(value.total / value.page_size)),
  };
}

export function parseAdminBusinessPage(value: unknown): AdminBusinessPage | null {
  const result = adminBusinessPageSchema.safeParse(value);
  return result.success ? withTotalPages(result.data) : null;
}

export function parseAdminBusinessDetail(value: unknown): AdminBusinessDetail | null {
  const result = adminBusinessDetailSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminUserPage(value: unknown): AdminUserPage | null {
  const result = adminUserPageSchema.safeParse(value);
  return result.success ? withTotalPages(result.data) : null;
}

export function parseAdminUserDetail(value: unknown): AdminUserDetail | null {
  const result = adminUserDetailSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function formatAuthProvider(provider: string) {
  if (provider === "email") return "Email/password";
  if (provider === "google") return "Google";

  return provider
    .split(/[:_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
