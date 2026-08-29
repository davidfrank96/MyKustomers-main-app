import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { loginAction } from "@/features/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { isGoogleAuthEnabled } from "@/features/auth/provider-status";

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
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);
  const [user, googleAuthEnabled] = await Promise.all([
    getAuthenticatedUser(),
    isGoogleAuthEnabled(),
  ]);

  if (user) {
    redirect(next as Route);
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
        </div>
      }
    />
  );
}
