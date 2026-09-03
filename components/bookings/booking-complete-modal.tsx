"use client";

import { useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BookingCompleteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BookingCompleteModal({
  open,
  onOpenChange,
}: BookingCompleteModalProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm p-5 sm:p-6"
        onOpenAutoFocus={() => {
          const activeElement =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          returnFocusRef.current =
            activeElement && activeElement !== document.body
              ? activeElement
              : document.getElementById("booking-journey-title");
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current?.isConnected
            ? returnFocusRef.current
            : document.getElementById("booking-journey-title");
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <div className="flex items-start gap-3.5 sm:gap-4">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-300 motion-reduce:transition-none"
            data-booking-complete-icon
            aria-hidden="true"
          >
            <CheckCircle2 className="size-6" />
          </span>
          <DialogHeader className="min-w-0 flex-1 pr-8">
            <DialogTitle>Booking complete</DialogTitle>
            <DialogDescription>
              Everything for this booking is finished.
            </DialogDescription>
          </DialogHeader>
        </div>
        <Button type="button" className="mt-5 w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
