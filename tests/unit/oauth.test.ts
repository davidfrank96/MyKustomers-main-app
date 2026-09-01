import { describe, expect, it } from "vitest";
import {
  buildOAuthCallbackUrl,
  getSafeOAuthNextPath,
  GOOGLE_AUTH_PROVIDER,
  GOOGLE_OAUTH_QUERY_PARAMS,
  isTrustedSupabaseOAuthUrl,
} from "@/features/auth/oauth";

describe("Google OAuth helpers", () => {
  it("uses the Google provider and configured application origin", () => {
    expect(GOOGLE_AUTH_PROVIDER).toBe("google");
    expect(GOOGLE_OAUTH_QUERY_PARAMS).toEqual({ prompt: "select_account" });
    expect(buildOAuthCallbackUrl("https://app.example")).toBe(
      "https://app.example/auth/callback?next=/dashboard",
    );
    expect(getSafeOAuthNextPath("/customers?status=active")).toBe(
      "/customers?status=active",
    );
  });

  it("replaces external next destinations with the dashboard", () => {
    expect(getSafeOAuthNextPath("https://attacker.example")).toBe("/dashboard");
    expect(getSafeOAuthNextPath("//attacker.example/path")).toBe("/dashboard");
    expect(getSafeOAuthNextPath("not-a-local-path")).toBe("/dashboard");
  });

  it("only accepts the configured Supabase authorization endpoint", () => {
    const supabaseUrl = "https://project-ref.supabase.co";

    expect(
      isTrustedSupabaseOAuthUrl(
        `${supabaseUrl}/auth/v1/authorize?provider=google`,
        supabaseUrl,
      ),
    ).toBe(true);
    expect(
      isTrustedSupabaseOAuthUrl(
        "https://attacker.example/auth/v1/authorize?provider=google",
        supabaseUrl,
      ),
    ).toBe(false);
    expect(
      isTrustedSupabaseOAuthUrl(`${supabaseUrl}/auth/v1/callback`, supabaseUrl),
    ).toBe(false);
  });
});
