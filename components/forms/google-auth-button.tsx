"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleOAuthAction } from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/action-state";
import { cn } from "@/lib/utils/cn";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"
      />
      <path
        fill="#34a853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.584-5.037-3.711H.956v2.333A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#fbbc05"
        d="M3.963 10.709A5.42 5.42 0 0 1 3.682 9c0-.593.102-1.17.281-1.709V4.958H.956A9.004 9.004 0 0 0 0 9c0 1.452.347 2.827.956 4.042l3.007-2.333Z"
      />
      <path
        fill="#ea4335"
        d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.582-2.582C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.958l3.007 2.333C4.672 5.164 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GoogleSubmitButton({
  enabled,
  mobilePresentation,
}: {
  enabled: boolean;
  mobilePresentation: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      className={cn(
        "w-full",
        mobilePresentation && "h-14 rounded-lg text-base font-semibold",
      )}
      disabled={!enabled || pending}
    >
      <GoogleMark />
      {pending ? "Signing you in..." : "Continue with Google"}
    </Button>
  );
}

export function GoogleAuthButton({
  enabled,
  next,
  mobilePresentation = false,
}: {
  enabled: boolean;
  next: string;
  mobilePresentation?: boolean;
}) {
  const [state, formAction] = useActionState(googleOAuthAction, initialAuthActionState);

  return (
    <div className={mobilePresentation ? "mt-8" : "mt-6"}>
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <GoogleSubmitButton enabled={enabled} mobilePresentation={mobilePresentation} />
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
