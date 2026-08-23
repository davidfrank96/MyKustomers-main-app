"use client";

import { useEffect } from "react";

type PublicCapabilityOpenEndpoint =
  "/api/confirmation/open" | "/api/amendment/open" | "/api/addon/open";

export function PublicCapabilityOpenTracker({
  endpoint,
  token,
}: {
  endpoint: PublicCapabilityOpenEndpoint;
  token: string;
}) {
  useEffect(() => {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  }, [endpoint, token]);

  return null;
}
