import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  consumeAuthRateLimit: vi.fn(),
  clearSuccessfulLoginRateLimit: vi.fn(),
  recordAuditEvent: vi.fn(),
  resolvePostAuthDestination: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/config/public-env", () => ({
  isSupabasePublicEnvConfigured: vi.fn(() => true),
  publicEnv: {
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  },
}));
vi.mock("@/lib/auth/server", () => ({
  getAuthenticatedUser: vi.fn(),
  toAuthenticatedUser: vi.fn((user) => user),
}));
vi.mock("@/lib/auth/current-business", () => ({ clearSelectedBusinessId: vi.fn() }));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock("@/lib/security/redirects", () => ({
  getSafeRedirectPath: vi.fn(() => "/dashboard"),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/oauth", () => ({
  buildOAuthCallbackUrl: vi.fn(),
  GOOGLE_AUTH_PROVIDER: "google",
  GOOGLE_OAUTH_QUERY_PARAMS: {},
  isTrustedSupabaseOAuthUrl: vi.fn(),
}));
vi.mock("@/features/auth/oauth-next", () => ({ setOAuthNextPath: vi.fn() }));
vi.mock("@/features/auth/provider-status", () => ({
  isGoogleAuthEnabled: vi.fn(),
}));
vi.mock("@/features/businesses/pending-onboarding", () => ({
  clearPendingBusinessOnboardingId: vi.fn(),
}));
vi.mock("@/lib/auth/post-auth", () => ({
  resolvePostAuthDestination: mocks.resolvePostAuthDestination,
}));
vi.mock("@/features/auth/password-recovery", () => ({
  clearPasswordRecoveryIntent: vi.fn(),
  hasPasswordRecoveryIntent: vi.fn(),
}));
vi.mock("@/features/auth/rate-limit", () => ({
  consumeAuthRateLimit: mocks.consumeAuthRateLimit,
  clearSuccessfulLoginRateLimit: mocks.clearSuccessfulLoginRateLimit,
}));

import {
  forgotPasswordAction,
  resendSignupConfirmationAction,
  signupAction,
} from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/action-state";

function allowed() {
  return {
    status: "allowed",
    remainingRequests: 2,
    retryAfterSeconds: 0,
    resetAt: null,
  } as const;
}

function signupForm() {
  const form = new FormData();
  form.set("displayName", "Taylor Example");
  form.set("email", "  Taylor+Desk@Example.COM ");
  form.set("password", "StrongPass123");
  form.set("confirmPassword", "StrongPass123");
  return form;
}

describe("Auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeAuthRateLimit.mockResolvedValue(allowed());
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("keeps confirmation-required signup out of onboarding and returns the exact normalized email", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ auth: { signUp } });

    await expect(signupAction(initialAuthActionState, signupForm())).resolves.toEqual({
      status: "success",
      code: "verification_required",
      message: "Check your email to confirm your account.",
      verification: {
        email: "taylor+desk@example.com",
        retryAfterSeconds: 60,
      },
    });
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "taylor+desk@example.com" }),
    );
    expect(mocks.resolvePostAuthDestination).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("fails Auth requests open when application storage is unavailable", async () => {
    mocks.consumeAuthRateLimit.mockResolvedValue({
      status: "unavailable",
      remainingRequests: null,
      retryAfterSeconds: 0,
      resetAt: null,
    });
    const signUp = vi.fn(async () => ({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ auth: { signUp } });

    await signupAction(initialAuthActionState, signupForm());
    expect(signUp).toHaveBeenCalledOnce();
  });

  it("returns retry metadata without calling the provider when recovery is limited", async () => {
    mocks.consumeAuthRateLimit.mockResolvedValue({
      status: "limited",
      remainingRequests: 0,
      retryAfterSeconds: 417,
      resetAt: "2026-09-02T12:00:00.000Z",
    });
    const resetPasswordForEmail = vi.fn();
    mocks.createClient.mockResolvedValue({ auth: { resetPasswordForEmail } });
    const form = new FormData();
    form.set("email", "person@example.com");

    await expect(
      forgotPasswordAction(initialAuthActionState, form),
    ).resolves.toMatchObject({
      status: "error",
      code: "rate_limited",
      retryAfterSeconds: 417,
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("resends through Supabase with neutral copy and the canonical callback", async () => {
    const resend = vi.fn(async () => ({ data: {}, error: null }));
    mocks.createClient.mockResolvedValue({ auth: { resend } });
    const form = new FormData();
    form.set("email", "Person+Desk@Example.com");

    await expect(
      resendSignupConfirmationAction(initialAuthActionState, form),
    ).resolves.toMatchObject({
      status: "success",
      code: "verification_resent",
      retryAfterSeconds: 60,
      verification: { email: "person+desk@example.com" },
    });
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person+desk@example.com",
      options: {
        emailRedirectTo: "https://app.example.com/auth/callback?next=/dashboard",
      },
    });
  });
});
