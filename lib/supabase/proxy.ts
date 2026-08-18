import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  assertSupabasePublicEnv,
  isSupabasePublicEnvConfigured,
} from "@/lib/config/public-env";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!isSupabasePublicEnvConfigured()) {
    return response;
  }

  const { url, publishableKey } = assertSupabasePublicEnv();
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet, headersToSet) {
      cookiesToSet.forEach(({ name, value }) => {
        request.cookies.set(name, value);
      });

      response = NextResponse.next({
        request,
      });

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });

      Object.entries(headersToSet).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    },
  };

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: cookieMethods,
  });

  await supabase.auth.getClaims();

  return response;
}
