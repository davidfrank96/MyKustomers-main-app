import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/config/public-env";

const optionalSecret = z
  .union([z.string().min(1), z.literal("")])
  .transform((value) => (value === "" ? undefined : value));

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret.optional(),
  RESEND_API_KEY: optionalSecret.optional(),
});

export const serverEnv = {
  ...publicEnv,
  ...serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
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
