import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database } from "@/types/database";

const safeTargets = new Set([
  "local",
  "dev",
  "development",
  "test",
  "testing",
  "staging",
]);

export function createRuntimeSecurityContext({
  suiteName,
  storagePrefix,
}: {
  suiteName: string;
  storagePrefix: string;
}) {
  function requiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is required for ${suiteName} runtime verification.`);
    }

    return value;
  }

  return {
    enabled:
      process.env.PHASE2_RUNTIME_VERIFICATION === "1" &&
      safeTargets.has((process.env.PHASE2_SUPABASE_TARGET ?? "").toLowerCase()) &&
      Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
    requiredEnv,
    createSupabaseClient(key: string) {
      return createClient<Database>(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: `${storagePrefix}-${randomUUID()}`,
        },
      });
    },
  };
}

export function expectNoRows<T>(data: T[] | null) {
  expect(data ?? []).toHaveLength(0);
}
