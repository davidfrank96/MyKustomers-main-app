import { getSafeRedirectPath } from "@/lib/security/redirects";

export const GOOGLE_AUTH_PROVIDER = "google" as const;
export const GOOGLE_OAUTH_QUERY_PARAMS = {
  prompt: "select_account",
} as const;

export function buildOAuthCallbackUrl(appUrl: string) {
  const callbackUrl = new URL("/auth/callback", appUrl);
  return `${callbackUrl.toString()}?next=/dashboard`;
}

export function getSafeOAuthNextPath(
  next: FormDataEntryValue | string | null | undefined,
) {
  return getSafeRedirectPath(next);
}

export function isTrustedSupabaseOAuthUrl(value: string, supabaseUrl: string) {
  try {
    const authorizationUrl = new URL(value);
    const configuredSupabaseUrl = new URL(supabaseUrl);

    return (
      authorizationUrl.origin === configuredSupabaseUrl.origin &&
      authorizationUrl.pathname === "/auth/v1/authorize"
    );
  } catch {
    return false;
  }
}
