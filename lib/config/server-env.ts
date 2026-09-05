import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/config/public-env";

const optionalSecret = z
  .union([z.string().min(1), z.literal("")])
  .transform((value) => (value === "" ? undefined : value));

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret.optional(),
  BREVO_API_KEY: optionalSecret.optional(),
  BREVO_WEBHOOK_SECRET: optionalSecret.optional(),
  RESEND_API_KEY: optionalSecret.optional(),
  TRANSACTIONAL_EMAIL_PROVIDER: z
    .enum(["development", "brevo", "resend"])
    .default("development"),
  TRANSACTIONAL_EMAIL_FROM: optionalSecret.optional(),
});

export const serverEnv = {
  ...publicEnv,
  ...serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_WEBHOOK_SECRET: process.env.BREVO_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TRANSACTIONAL_EMAIL_PROVIDER: process.env.TRANSACTIONAL_EMAIL_PROVIDER,
    TRANSACTIONAL_EMAIL_FROM: process.env.TRANSACTIONAL_EMAIL_FROM,
  }),
};

export function isSupabaseServiceRoleEnvConfigured() {
  return Boolean(serverEnv.SUPABASE_SERVICE_ROLE_KEY);
}

export function assertSupabaseServiceRoleEnv() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return serverEnv.SUPABASE_SERVICE_ROLE_KEY;
}
