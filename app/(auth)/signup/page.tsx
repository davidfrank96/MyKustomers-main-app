import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { signupAction } from "@/features/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { isGoogleAuthEnabled } from "@/features/auth/provider-status";

export default async function SignupPage() {
  const [user, googleAuthEnabled] = await Promise.all([
    getAuthenticatedUser(),
    isGoogleAuthEnabled(),
  ]);

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthForm
      title="Create your account"
      description="Create your My Kustomers login. You will set up your business next."
      action={signupAction}
      submitLabel="Create account"
      presentation="mobile"
      googleAuth={{ enabled: googleAuthEnabled, next: "/dashboard" }}
      fields={[
        {
          name: "displayName",
          label: "Your name",
          type: "text",
          autoComplete: "name",
          required: true,
          placeholder: "Enter your full name",
        },
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
          autoComplete: "new-password",
          required: true,
          placeholder: "Create a password",
        },
        {
          name: "confirmPassword",
          label: "Confirm password",
          type: "password",
          autoComplete: "new-password",
          required: true,
          placeholder: "Confirm your password",
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
