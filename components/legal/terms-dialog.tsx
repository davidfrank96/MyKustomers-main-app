"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TermsDialog({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <a
          href="/terms"
          className={className}
          onClick={(event) => {
            // Keep the canonical link usable without JS and for new-tab gestures.
            event.preventDefault();
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              window.open("/terms", "_blank", "noopener,noreferrer");
              return;
            }
            setOpen(true);
          }}
        >
          Terms of Service
        </a>
      </DialogTrigger>
      <DialogContent className="flex max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>My Kustomers Terms of Service</DialogTitle>
          <DialogDescription>Information about using My Kustomers.</DialogDescription>
        </DialogHeader>
        <div
          className="my-4 min-h-0 overflow-y-auto overscroll-contain pr-2"
          tabIndex={0}
          aria-label="Terms of Service text"
        >
          {children}
        </div>
        <a
          href="/terms"
          className="inline-flex min-h-11 shrink-0 items-center self-start font-medium text-primary underline underline-offset-4"
        >
          Read the full page
        </a>
      </DialogContent>
    </Dialog>
  );
}
