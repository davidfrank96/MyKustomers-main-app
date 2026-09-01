import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { signupAction } from "@/features/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { isGoogleAuthEnabled } from "@/features/auth/provider-status";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth";

export default async function SignupPage() {
  const [user, googleAuthEnabled] = await Promise.all([
    getAuthenticatedUser(),
    isGoogleAuthEnabled(),
  ]);

  if (user) {
    redirect((await resolvePostAuthDestination("/dashboard", user)) as Route);
  }

  return (
    <AuthForm
      title="Create your account"
      description="Create your My Customers login. You will set up your business next."
      action={signupAction}
      submitLabel="Create account"
      googleAuth={{ enabled: googleAuthEnabled, next: "/dashboard" }}
      fields={[
        {
          name: "displayName",
          label: "Your name",
          type: "text",
          autoComplete: "name",
          required: true,
        },
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          required: true,
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          required: true,
        },
        {
          name: "confirmPassword",
          label: "Confirm password",
          type: "password",
          autoComplete: "new-password",
          required: true,
        },
      ]}
      footer={
        <span>
          Already have an account?{" "}
          <Link href={"/login" as Route} className="font-medium text-primary">
            Log in
          </Link>
        </span>
      }
    />
  );
}
