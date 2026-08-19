import { z } from "zod";
import { bookingCurrencies, parseMoneyToMinorUnits } from "@/features/bookings/money";
import { bookingStatuses } from "@/features/bookings/status";

export const bookingListFilters = [
  "all",
  "today",
  "upcoming",
  "overdue",
  ...bookingStatuses,
] as const;

export type BookingListFilter = (typeof bookingListFilters)[number];

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(maxLength).optional());
}

function moneyField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value, ctx) => {
      const parsed = parseMoneyToMinorUnits(value);

      if (parsed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid amount with up to 2 decimals.`,
        });
        return z.NEVER;
      }

      return parsed;
    });
}

const bookingFieldsSchema = z.object({
  customerId: z.string().uuid("Choose a customer."),
  title: z
    .string()
    .trim()
    .min(1, "Booking title is required.")
    .max(160, "Booking title must be 160 characters or fewer."),
  description: optionalTrimmedString(5000),
  currency: z.enum(bookingCurrencies, {
    errorMap: () => ({ message: "Choose a valid currency." }),
  }),
  totalAmount: moneyField("Agreed total"),
  depositAmount: moneyField("Deposit recorded"),
  scheduledFor: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }, z.string().datetime("Enter a valid scheduled date.").optional()),
  internalNotes: optionalTrimmedString(5000),
});

function enforceDepositLimit<T extends { totalAmount: number; depositAmount: number }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.depositAmount > value.totalAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["depositAmount"],
      message: "Deposit recorded cannot be greater than agreed total.",
    });
  }
}

export const bookingCreateSchema = bookingFieldsSchema.superRefine(enforceDepositLimit);

export const bookingUpdateSchema = bookingFieldsSchema
  .omit({ customerId: true })
  .superRefine(enforceDepositLimit);

export const bookingTransitionSchema = z.object({
  toStatus: z.enum(bookingStatuses),
  cancellationReason: optionalTrimmedString(500),
});

export const bookingRescheduleSchema = z.object({
  scheduledFor: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }, z.string().datetime("Enter a valid scheduled date.")),
}).superRefine((value, ctx) => {
  if (new Date(value.scheduledFor).getTime() <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduledFor"],
      message: "Choose a future scheduled date.",
    });
  }
});

export const bookingListParamsSchema = z.object({
  q: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string())
    .transform((value) => value.slice(0, 80)),
  filter: z.enum(bookingListFilters).catch("all"),
  page: z
    .preprocess((value) => Number.parseInt(String(value ?? "1"), 10), z.number().int().min(1))
    .catch(1),
  limit: z
    .preprocess((value) => Number.parseInt(String(value ?? "10"), 10), z.number().int().min(1).max(25))
    .catch(10),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type BookingRescheduleInput = z.infer<typeof bookingRescheduleSchema>;
export type BookingListParams = z.infer<typeof bookingListParamsSchema>;

export function parseBookingListParams(input: Record<string, string | string[] | undefined>) {
  return bookingListParamsSchema.parse({
    q: typeof input.q === "string" ? input.q : "",
    filter: typeof input.filter === "string" ? input.filter : "all",
    page: typeof input.page === "string" ? input.page : "1",
    limit: typeof input.limit === "string" ? input.limit : "10",
  });
}

export function isBookingReference(value: string) {
  return /^MC-[0-9]{6}-[A-F0-9]{6}$/.test(value);
}
