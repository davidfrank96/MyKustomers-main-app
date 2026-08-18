import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabasePublicEnv } from "@/lib/config/public-env";
import type { Database } from "@/types/database";

export async function createClient() {
  const { url, publishableKey } = assertSupabasePublicEnv();
  const cookieStore = await cookies();
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server Components cannot set cookies; middleware will refresh sessions later.
      }
    },
  };

  return createServerClient<Database>(url, publishableKey, {
    cookies: cookieMethods,
  });
}
