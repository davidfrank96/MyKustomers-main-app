import { z } from "zod";

const phonePattern = /^[0-9+().\s-]+$/;

export const confirmationContactSchema = z.object({
  contactEmail: z
    .string({ required_error: "Email address is required." })
    .trim()
    .min(1, "Email address is required.")
    .max(254, "Email address must be 254 characters or fewer.")
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  contactPhone: z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(7, "Phone must be at least 7 characters.").max(32, "Phone must be 32 characters or fewer.").regex(phonePattern, "Enter a valid phone number.").optional()),
});

export type ConfirmationContactInput = z.infer<typeof confirmationContactSchema>;
