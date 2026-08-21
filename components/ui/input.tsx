import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 min-w-0 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
