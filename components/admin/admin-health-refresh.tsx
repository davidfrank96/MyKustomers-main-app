"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function AdminHealthRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full shrink-0 rounded-md md:w-44"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-busy={pending}
    >
      <RefreshCw
        className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
      <span aria-live="polite">{pending ? "Refreshing..." : "Refresh status"}</span>
    </Button>
  );
}
