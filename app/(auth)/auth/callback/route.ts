import { NextResponse, type NextRequest } from "next/server";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { createClient } from "@/lib/supabase/server";
import { consumeOAuthNextPath } from "@/features/auth/oauth-next";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { toAuthenticatedUser } from "@/lib/auth/server";
import { setPasswordRecoveryIntent } from "@/features/auth/password-recovery";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const oauthNext = await consumeOAuthNextPath();
  const isPasswordRecovery = requestedNext === "/reset-password";
  const next = isPasswordRecovery ? requestedNext : (oauthNext ?? requestedNext);

  if (requestUrl.searchParams.has("error")) {
    return NextResponse.redirect(
      new URL(
        isPasswordRecovery
          ? "/forgot-password?message=invalid-reset-link"
          : "/login?message=oauth-error",
        request.url,
      ),
    );
  }

  if (!code || !isSupabasePublicEnvConfigured()) {
    return NextResponse.redirect(
      new URL(
        isPasswordRecovery
          ? "/forgot-password?message=invalid-reset-link"
          : "/login?message=auth-error",
        request.url,
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        isPasswordRecovery
          ? "/forgot-password?message=invalid-reset-link"
          : "/login?message=auth-error",
        request.url,
      ),
    );
  }

  if (isPasswordRecovery) {
    await setPasswordRecoveryIntent();
  }

  const destination = await resolvePostAuthDestination(
    next,
    toAuthenticatedUser(data.user),
  );
  return NextResponse.redirect(new URL(destination, request.url));
}
