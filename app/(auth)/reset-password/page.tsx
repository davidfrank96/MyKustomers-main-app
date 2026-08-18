import Link from "next/link";
import type { Route } from "next";
import { AuthForm } from "@/components/forms/auth-form";
import { resetPasswordAction } from "@/features/auth/actions";

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="Choose a new password"
      description="Use the recovery link from your email before setting a new password."
      action={resetPasswordAction}
      submitLabel="Update password"
      fields={[
        {
          name: "password",
          label: "New password",
          type: "password",
          autoComplete: "new-password",
          required: true,
        },
        {
          name: "confirmPassword",
          label: "Confirm new password",
          type: "password",
          autoComplete: "new-password",
          required: true,
        },
      ]}
      footer={
        <Link href={"/forgot-password" as Route} className="font-medium text-primary">
          Request a new reset link
        </Link>
      }
    />
  );
}
