import { z } from "zod";
import { bookingCurrencies, parseMoneyToMinorUnits } from "@/features/bookings/money";

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

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const clean = value.trim();
    return clean || undefined;
  }, z.string().max(max).optional());

export const bookingAmendmentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Explain why these changes are needed.")
      .max(500, "Reason must be 500 characters or fewer.")
      .refine(
        (value) => !/<\s*\/?\s*[a-z][^>]*>/i.test(value),
        "Reason must be plain text.",
      ),
    title: z
      .string()
      .trim()
      .min(1, "Booking title is required.")
      .max(160, "Booking title must be 160 characters or fewer."),
    description: optionalText(5000),
    currency: z.enum(bookingCurrencies),
    totalAmount: moneyField("Agreed total"),
    depositAmount: moneyField("Deposit recorded"),
    scheduledFor: z.preprocess((value) => {
      if (typeof value !== "string" || !value.trim()) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toISOString();
    }, z.string().datetime("Enter a valid scheduled date.").optional()),
  })
  .superRefine((value, ctx) => {
    if (value.depositAmount > value.totalAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depositAmount"],
        message: "Deposit recorded cannot be greater than agreed total.",
      });
    }
    if (value.scheduledFor && new Date(value.scheduledFor).getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledFor"],
        message: "Choose a future scheduled date.",
      });
    }
  });

export type BookingAmendmentInput = z.infer<typeof bookingAmendmentSchema>;
