import { z } from "zod";
import { parseMoneyToMinorUnits } from "@/features/bookings/money";

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

const optionalDescription = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean || undefined;
}, z.string().max(5000, "Description must be 5,000 characters or fewer.").optional());

export const bookingAddonSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Add-on title is required.")
      .max(160, "Add-on title must be 160 characters or fewer."),
    description: optionalDescription,
    totalAmount: moneyField("Agreed amount"),
    depositAmount: moneyField("Deposit recorded"),
  })
  .superRefine((value, ctx) => {
    if (value.depositAmount > value.totalAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depositAmount"],
        message: "Deposit recorded cannot be greater than agreed amount.",
      });
    }
  });

export type BookingAddonInput = z.infer<typeof bookingAddonSchema>;
