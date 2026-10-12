"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function LegalBackLink() {
  const router = useRouter();
  return (
    <Link
      href="/"
      className="mb-5 inline-flex min-h-11 items-center gap-1 rounded text-sm font-medium text-primary print:hidden"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // A direct or external arrival has a working home fallback, including without JS.
        if (
          document.referrer &&
          new URL(document.referrer).origin === location.origin &&
          history.length > 1
        ) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      Back
    </Link>
  );
}
