import { NextResponse, type NextRequest } from "next/server";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { createClient } from "@/lib/supabase/server";
import { consumeOAuthNextPath } from "@/features/auth/oauth-next";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthNext = await consumeOAuthNextPath();
  const next = oauthNext ?? getSafeRedirectPath(requestUrl.searchParams.get("next"));

  if (requestUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/login?message=oauth-error", request.url));
  }

  if (!code || !isSupabasePublicEnvConfigured()) {
    return NextResponse.redirect(new URL("/login?message=auth-error", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?message=auth-error", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
