import { TermsLink } from "@/components/legal/terms-link";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { loginAction } from "@/features/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { isGoogleAuthEnabled } from "@/features/auth/provider-status";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";
import { BusinessMembershipLookupError } from "@/lib/auth/business-access";
import { storageFailureTags } from "@/lib/observability/storage-failure";
import * as Sentry from "@sentry/nextjs";
import { buttonVariants } from "@/components/ui/button";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    message?: string;
  }>;
};

const messages: Record<string, string> = {
  "signed-out": "You have been signed out.",
  "auth-error": "We could not complete authentication. Please try again.",
  "oauth-error": "Google sign-in was not completed. Try again or use email.",
  "password-updated": "Your password has been updated. Log in with your new password.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);
  const [user, googleAuthEnabled] = await Promise.all([
    getAuthenticatedUser(),
    isGoogleAuthEnabled(),
  ]);

  if (user) {
    let destination: string;
    try {
      destination = await resolvePostAuthDestination(next, user);
    } catch (error) {
      if (!(error instanceof BusinessMembershipLookupError)) throw error;
      Sentry.captureMessage("Workspace access temporarily unavailable", {
        level: "error",
        tags: { auth_stage: "workspace_lookup", ...storageFailureTags(error) },
      });
      return (
        <section className="w-full space-y-5 rounded-xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold">We couldn’t open your workspace</h1>
          <p role="status" className="text-sm text-muted-foreground">
            You’re signed in, but we couldn’t verify your business access. Please try
            again in a moment. You don’t need to reset your password or create another
            account.
          </p>
          <a
            className={buttonVariants({ className: "w-full" })}
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Try again
          </a>
        </section>
      );
    }
    // Next redirects throw; keep them outside the lookup catch.
    redirect(destination as Route);
  }

  return (
    <AuthForm
      title="Log in"
      description="Access your My Kustomers workspace."
      action={loginAction}
      submitLabel="Log in"
      presentation="mobile"
      hiddenFields={{ next }}
      googleAuth={{ enabled: googleAuthEnabled, next }}
      message={params.message ? messages[params.message] : undefined}
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          required: true,
          placeholder: "Enter your email address",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "current-password",
          required: true,
          placeholder: "Enter your password",
        },
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <Link href={"/forgot-password" as Route} className="font-medium text-primary">
            Forgot your password?
          </Link>
          <span>
            New to My Kustomers?{" "}
            <Link href={"/signup" as Route} className="font-medium text-primary">
              Create an account
            </Link>
          </span>
          <TermsLink className="font-medium text-primary" />
        </div>
      }
    />
  );
}
