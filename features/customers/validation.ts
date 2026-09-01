import { z } from "zod";

const phonePattern = /^[0-9+().\s-]+$/;

export const customerArchiveFilters = ["active", "archived", "all"] as const;
export type CustomerArchiveFilter = (typeof customerArchiveFilters)[number];

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(maxLength).optional());
}

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Customer name is required.")
  .max(160, "Customer name must be 160 characters or fewer.");

export const customerEmailSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().email("Enter a valid customer email.").max(254).optional());

export const customerPhoneSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(7, "Phone must be at least 7 characters.").max(32, "Phone must be 32 characters or fewer.").regex(phonePattern, "Phone can only contain numbers, spaces, +, -, parentheses, and periods.").optional());

export const customerFormSchema = z.object({
  name: customerNameSchema,
  email: customerEmailSchema,
  phone: customerPhoneSchema,
  notes: optionalTrimmedString(5000),
});

export type CustomerFormInput = z.infer<typeof customerFormSchema>;

export const customerListParamsSchema = z.object({
  q: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string())
    .transform((value) => value.slice(0, 80)),
  status: z.enum(customerArchiveFilters).catch("active"),
  page: z
    .preprocess(
      (value) => Number.parseInt(String(value ?? "1"), 10),
      z.number().int().min(1),
    )
    .catch(1),
  limit: z
    .preprocess(
      (value) => Number.parseInt(String(value ?? "25"), 10),
      z.number().int().min(1).max(25),
    )
    .catch(25),
});

export type CustomerListParams = z.infer<typeof customerListParamsSchema>;

export function parseCustomerListParams(
  input: Record<string, string | string[] | undefined>,
) {
  return customerListParamsSchema.parse({
    q: typeof input.q === "string" ? input.q : "",
    status: typeof input.status === "string" ? input.status : "active",
    page: "1",
    limit: "25",
  });
}
