"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

function businessInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "MK";
}

export function BusinessLogo({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url && failedUrl !== url);

  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted text-sm font-semibold text-foreground",
        className,
      )}
      aria-label={`${name} logo`}
    >
      {showImage ? (
        // Public business logos are already resized and optimized by the upload boundary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedUrl(url!)}
        />
      ) : (
        <span aria-hidden="true">{businessInitials(name)}</span>
      )}
    </span>
  );
}
