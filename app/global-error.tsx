"use client";

import * as Sentry from "@sentry/nextjs";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global" },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
          <section aria-labelledby="global-error-title">
            <TriangleAlert className="size-7 text-destructive" aria-hidden="true" />
            <h1 id="global-error-title" className="mt-4 text-3xl font-semibold">
              Something went wrong
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              The page could not be loaded. Try again, or return later if the problem
              continues.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex min-h-11 items-center gap-2 bg-primary px-4 font-medium text-primary-foreground"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
