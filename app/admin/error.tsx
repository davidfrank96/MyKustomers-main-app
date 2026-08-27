"use client";

import * as Sentry from "@sentry/nextjs";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "admin" },
    });
  }, [error]);

  return (
    <section aria-labelledby="admin-error-title" className="border-y border-border py-10">
      <TriangleAlert className="size-6 text-destructive" aria-hidden="true" />
      <h1 id="admin-error-title" className="mt-4 text-2xl font-semibold">
        Platform operations unavailable
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        The overview could not load current operational data.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center gap-2 bg-primary px-4 font-medium text-primary-foreground"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Retry
      </button>
    </section>
  );
}
