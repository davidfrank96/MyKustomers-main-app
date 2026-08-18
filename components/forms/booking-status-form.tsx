"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type BookingStatusFormProps = {
  action: () => Promise<void>;
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  confirmMessage?: string;
};

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "Please wait..." : label}
    </Button>
  );
}

export function BookingStatusForm({
  action,
  label,
  variant = "secondary",
  confirmMessage,
}: BookingStatusFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton label={label} variant={variant} />
    </form>
  );
}
