"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  initialPublicAddonActionState,
  type PublicAddonActionState,
} from "@/features/addons/action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Confirming add-on..." : "Confirm add-on"}
    </Button>
  );
}

export function PublicAddonForm({
  action,
}: {
  action: (
    previousState: PublicAddonActionState,
    formData: FormData,
  ) => Promise<PublicAddonActionState>;
}) {
  const [state, formAction] = useActionState(action, initialPublicAddonActionState);
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        By confirming, you agree that this additional scope becomes part of your existing
        booking. It does not replace the original booking.
      </p>
      {state.message ? (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
