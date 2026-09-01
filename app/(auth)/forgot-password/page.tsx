import Link from "next/link";
import type { Route } from "next";
import { AuthForm } from "@/components/forms/auth-form";
import { forgotPasswordAction } from "@/features/auth/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthForm
      title="Reset your password"
      description="Enter your email and we will send a reset link if an account exists."
      action={forgotPasswordAction}
      message={
        params.message === "invalid-reset-link"
          ? "That password reset link is invalid or expired. Request a new one."
          : undefined
      }
      submitLabel="Send reset link"
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          required: true,
        },
      ]}
      footer={
        <Link href={"/login" as Route} className="font-medium text-primary">
          Back to login
        </Link>
      }
    />
  );
}
