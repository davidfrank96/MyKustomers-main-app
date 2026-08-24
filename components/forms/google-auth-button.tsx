"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleOAuthAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/action-state";

function GoogleSubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      className="w-full"
      disabled={!enabled || pending}
    >
      {pending ? "Connecting..." : "Continue with Google"}
    </Button>
  );
}

export function GoogleAuthButton({
  enabled,
  next,
}: {
  enabled: boolean;
  next: string;
}) {
  const [state, formAction] = useActionState(
    googleOAuthAction,
    initialAuthActionState,
  );

  return (
    <div className="mt-6">
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <GoogleSubmitButton enabled={enabled} />
      </form>
      {!enabled ? (
        <p className="mt-2 text-sm leading-5 text-muted-foreground" role="status">
          Google sign-in is not available yet. Use email to continue.
        </p>
      ) : state.message ? (
        <p className="mt-2 flex gap-2 text-sm leading-5 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
