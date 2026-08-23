"use client";

import { useEffect } from "react";

export function ConfirmationOpenTracker({ token }: { token: string }) {
  useEffect(() => {
    void fetch("/api/confirmation/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  }, [token]);

  return null;
}
