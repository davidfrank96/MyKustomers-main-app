import { z } from "zod";
export function normalizeWhatsAppPhone(input: string) {
  return input.trim().replace(/[\s()\-]/g, "");
}
export const e164Schema = z
  .string()
  .transform(normalizeWhatsAppPhone)
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9][0-9]{7,14}$/,
        "Enter an international number beginning with + and its country code.",
      ),
  );
export const communicationPreferenceSchema = z
  .object({
    emailEnabled: z.boolean(),
    whatsappEnabled: z.boolean(),
    recipient: z.string().optional(),
    consent: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.emailEnabled && !value.whatsappEnabled)
      ctx.addIssue({
        code: "custom",
        path: ["emailEnabled"],
        message: "Choose at least one update channel.",
      });
    if (value.whatsappEnabled && !e164Schema.safeParse(value.recipient).success)
      ctx.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Enter a valid international WhatsApp number.",
      });
    if (value.whatsappEnabled && !value.consent)
      ctx.addIssue({
        code: "custom",
        path: ["consent"],
        message: "Confirm the customer agreed to WhatsApp updates for this booking.",
      });
  });
export const whatsappStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Sending",
  ACCEPTED: "Accepted",
  DELIVERED: "Delivered",
  READ: "Read",
  FAILED: "Failed",
  UNKNOWN: "Delivery status uncertain",
  CANCELLED: "Updates stopped",
};
