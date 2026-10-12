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

export function LegalDocumentDialog({
  children,
  className,
  href,
  title,
  trigger,
  textLabel,
  fullPageLabel = "Read the full page",
  triggerLabel,
  triggerDescription,
}: {
  children: ReactNode;
  className?: string;
  href: "/terms" | "/about";
  title: string;
  trigger: ReactNode;
  textLabel: string;
  fullPageLabel?: string;
  triggerLabel?: string;
  triggerDescription?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <a
          href={href}
          className={className}
          aria-labelledby={triggerLabel}
          aria-describedby={triggerDescription}
          onClick={(event) => {
            // Keep the canonical link usable without JS and for new-tab gestures.
            event.preventDefault();
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              window.open(href, "_blank", "noopener,noreferrer");
              return;
            }
            setOpen(true);
          }}
        >
          {trigger}
        </a>
      </DialogTrigger>
      <DialogContent className="flex max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Information about using My Kustomers.</DialogDescription>
        </DialogHeader>
        <div
          className="my-4 min-h-0 overflow-y-auto overscroll-contain pr-2"
          tabIndex={0}
          aria-label={textLabel}
        >
          {children}
        </div>
        <a
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center self-start font-medium text-primary underline underline-offset-4"
        >
          {fullPageLabel}
        </a>
      </DialogContent>
    </Dialog>
  );
}

export function TermsDialog({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <LegalDocumentDialog
      href="/terms"
      title="My Kustomers Terms of Service"
      trigger="Terms of Service"
      textLabel="Terms of Service text"
      className={className}
    >
      {children}
    </LegalDocumentDialog>
  );
}
