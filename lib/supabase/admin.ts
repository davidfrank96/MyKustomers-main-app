import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  assertSupabasePublicEnv,
  isSupabasePublicEnvConfigured,
} from "@/lib/config/public-env";
import {
  assertSupabaseServiceRoleEnv,
  isSupabaseServiceRoleEnvConfigured,
} from "@/lib/config/server-env";
import type { Database } from "@/types/database";

export function canUseServiceRoleClient() {
  return isSupabasePublicEnvConfigured() && isSupabaseServiceRoleEnvConfigured();
}

export function createServiceRoleClient() {
  const { url } = assertSupabasePublicEnv();
  const serviceRoleKey = assertSupabaseServiceRoleEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
