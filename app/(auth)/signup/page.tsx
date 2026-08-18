import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/forms/auth-form";
import { signupAction } from "@/features/auth/actions";
import { getAuthenticatedUser } from "@/lib/auth/server";

export default async function SignupPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthForm
      title="Create your account"
      description="Set up your platform user. Business onboarding comes next."
      action={signupAction}
      submitLabel="Create account"
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
