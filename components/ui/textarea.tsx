import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 min-w-0 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
