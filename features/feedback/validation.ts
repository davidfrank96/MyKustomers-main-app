import { z } from "zod";

export const issueCategories = [
  "LATE_DELIVERY",
  "CUSTOMER_REQUESTED_CHANGE",
  "PRODUCT_DAMAGED",
  "COMMUNICATION_ISSUE",
  "PAYMENT_BALANCE_ISSUE",
  "NO_SHOW",
  "OTHER",
] as const;

export const issueStatuses = ["OPEN", "RESOLVED"] as const;

export const issueCategoryLabels: Record<(typeof issueCategories)[number], string> = {
  LATE_DELIVERY: "Late delivery",
  CUSTOMER_REQUESTED_CHANGE: "Customer requested change",
  PRODUCT_DAMAGED: "Product damaged",
  COMMUNICATION_ISSUE: "Communication issue",
  PAYMENT_BALANCE_ISSUE: "Payment or balance issue",
  NO_SHOW: "No-show",
  OTHER: "Other",
};

function optionalComment(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(maxLength, `Comment must be ${maxLength} characters or fewer.`).optional())
    .superRefine((value, ctx) => {
      if (value && /<[^>]*>/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use plain text only.",
        });
      }
    });
}

function yesNoBoolean(label: string) {
  return z.enum(["yes", "no"], {
    errorMap: () => ({ message: `${label} is required.` }),
  }).transform((value) => value === "yes");
}

export const publicFeedbackSchema = z.object({
  overallRating: z.preprocess(
    (value) => Number.parseInt(String(value ?? ""), 10),
    z.number().int().min(1, "Choose a rating.").max(5, "Choose a rating from 1 to 5."),
  ),
  onTime: yesNoBoolean("On-time response"),
  metExpectations: yesNoBoolean("Expectation response"),
  comment: optionalComment(2000),
});

export const bookingIssueCreateSchema = z.object({
  category: z.enum(issueCategories, {
    errorMap: () => ({ message: "Choose an issue category." }),
  }),
  description: z
    .string()
    .trim()
    .min(1, "Issue description is required.")
    .max(2000, "Issue description must be 2000 characters or fewer."),
});

export function isFeedbackEligibleStatus(status: string) {
  return status === "COMPLETED";
}

export function isResolvableIssueStatus(status: string) {
  return status === "OPEN";
}

export type PublicFeedbackInput = z.infer<typeof publicFeedbackSchema>;
export type BookingIssueCreateInput = z.infer<typeof bookingIssueCreateSchema>;
