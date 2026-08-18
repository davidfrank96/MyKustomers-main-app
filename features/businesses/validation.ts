import { z } from "zod";

export const businessCategories = [
  "Food & Catering",
  "Bakery",
  "Fashion",
  "Beauty",
  "Photography",
  "Events",
  "Cleaning",
  "Professional Services",
  "Other",
] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const phonePattern = /^[0-9+().\s-]+$/;
const instagramPattern = /^[a-z0-9._]+$/;

export function slugifyBusinessSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(maxLength).optional());
}

function optionalPhone(label: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(7, `${label} must be at least 7 characters.`).max(32, `${label} must be 32 characters or fewer.`).regex(phonePattern, `${label} can only contain numbers, spaces, +, -, parentheses, and periods.`).optional());
}

function optionalInstagram() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim().replace(/^@/, "").toLowerCase();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(1).max(30).regex(instagramPattern, "Use a handle like @divinecakes.").optional());
}

export const businessProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Business name is required.")
      .max(160, "Business name must be 160 characters or fewer."),
    slug: z.string().trim().optional(),
    category: z.enum(businessCategories, {
      errorMap: () => ({ message: "Choose a valid category." }),
    }),
    description: optionalTrimmedString(1000),
    phone: optionalPhone("Phone"),
    email: z.preprocess((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim().toLowerCase();
      return trimmed.length === 0 ? undefined : trimmed;
    }, z.string().email("Enter a valid business email.").max(254).optional()),
    whatsapp: optionalPhone("WhatsApp"),
    instagram: optionalInstagram(),
    addressText: optionalTrimmedString(500),
  })
  .superRefine((value, ctx) => {
    const normalizedSlug = slugifyBusinessSlug(value.slug || value.name);

    if (normalizedSlug.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Slug must be at least 3 URL-safe characters.",
      });
      return;
    }

    if (!slugPattern.test(normalizedSlug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "Slug can only contain lowercase letters, numbers, and hyphens.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    slug: slugifyBusinessSlug(value.slug || value.name),
  }));

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
