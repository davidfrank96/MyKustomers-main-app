"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { publicEnv, isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getAuthenticatedUser, toAuthenticatedUser } from "@/lib/auth/server";
import { clearSelectedBusinessId } from "@/lib/auth/current-business";
import { recordAuditEvent } from "@/lib/security/audit";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/action-state";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/validation";
import { mapSupabaseAuthError } from "@/features/auth/errors";
import {
  buildOAuthCallbackUrl,
  GOOGLE_AUTH_PROVIDER,
  isTrustedSupabaseOAuthUrl,
} from "@/features/auth/oauth";
import { setOAuthNextPath } from "@/features/auth/oauth-next";
import { isGoogleAuthEnabled } from "@/features/auth/provider-status";
import { clearPendingBusinessOnboardingId } from "@/features/businesses/pending-onboarding";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies AuthActionState;
}

function supabaseUnavailableState() {
  return {
    status: "error",
    message: "Supabase is not configured for this environment.",
  } satisfies AuthActionState;
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (!isSupabasePublicEnvConfigured()) {
    return supabaseUnavailableState();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
      },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: mapSupabaseAuthError(error.message),
    };
  }

  if (data.user) {
    await recordAuditEvent({
      actorUserId: data.user.id,
      eventType: "AUTH_SIGNUP",
      metadata: { source: "server_action" },
    });
  }

  if (data.session && data.user) {
    redirect(
      (await resolvePostAuthDestination(
        "/dashboard",
        toAuthenticatedUser(data.user),
      )) as Route,
    );
  }

  return {
    status: "success",
    message: "Check your email to confirm your account.",
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    next: formValue(formData, "next"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (!isSupabasePublicEnvConfigured()) {
    return supabaseUnavailableState();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      status: "error",
      message: mapSupabaseAuthError(error?.message),
    };
  }

  await recordAuditEvent({
    actorUserId: data.user.id,
    eventType: "AUTH_LOGIN",
    metadata: { source: "server_action" },
  });

  redirect(
    (await resolvePostAuthDestination(
      parsed.data.next,
      toAuthenticatedUser(data.user),
    )) as Route,
  );
}

export async function googleOAuthAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabasePublicEnvConfigured() || !publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    return supabaseUnavailableState();
  }

  if (!(await isGoogleAuthEnabled())) {
    return {
      status: "error",
      message: "Google sign-in is not available. Use email to continue.",
    };
  }

  const next = getSafeRedirectPath(formValue(formData, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: GOOGLE_AUTH_PROVIDER,
    options: {
      redirectTo: buildOAuthCallbackUrl(publicEnv.NEXT_PUBLIC_APP_URL),
    },
  });

  if (
    error ||
    !data.url ||
    !isTrustedSupabaseOAuthUrl(data.url, publicEnv.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    return {
      status: "error",
      message: "Google sign-in could not be started. Try again or use email.",
    };
  }

  await setOAuthNextPath(next);
  redirect(data.url as Route);
}

export async function logoutAction() {
  const user = await getAuthenticatedUser();

  if (isSupabasePublicEnvConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  if (user) {
    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "AUTH_LOGOUT",
      metadata: { source: "server_action" },
    });
  }

  await clearSelectedBusinessId();
  await clearPendingBusinessOnboardingId();

  redirect("/login?message=signed-out" as Route);
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (!isSupabasePublicEnvConfigured()) {
    return supabaseUnavailableState();
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  await recordAuditEvent({
    eventType: "PASSWORD_RESET_REQUESTED",
    metadata: { source: "server_action" },
  });

  return {
    status: "success",
    message: "If an account exists for that email, a reset link will be sent.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (!isSupabasePublicEnvConfigured()) {
    return supabaseUnavailableState();
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      status: "error",
      message: "Your reset link is invalid or expired. Request a new password reset.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: mapSupabaseAuthError(error.message),
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    eventType: "PASSWORD_UPDATED",
    metadata: { source: "server_action" },
  });

  redirect((await resolvePostAuthDestination("/dashboard", user)) as Route);
}
