"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabasePublicEnv } from "@/lib/config/public-env";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, publishableKey } = assertSupabasePublicEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
