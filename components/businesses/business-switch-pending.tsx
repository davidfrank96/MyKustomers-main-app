"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function BusinessSwitchPending() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background px-5"
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-sm font-medium">
        <LoaderCircle
          className="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Switching business...
      </div>
    </div>
  );
}
