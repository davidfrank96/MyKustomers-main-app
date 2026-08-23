"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  initialPublicAmendmentActionState,
  type PublicAmendmentActionState,
} from "@/features/amendments/action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Confirming changes..." : "Confirm changes"}
    </Button>
  );
}

export function PublicAmendmentForm({
  action,
}: {
  action: (
    previousState: PublicAmendmentActionState,
    formData: FormData,
  ) => Promise<PublicAmendmentActionState>;
}) {
  const [state, formAction] = useActionState(action, initialPublicAmendmentActionState);
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        By confirming, you agree that the proposed values replace the current values shown
        above.
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
