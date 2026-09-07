"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastRoot = ToastPrimitive.Root;
export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;

export function ToastViewport({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 lg:bottom-4",
        className,
      )}
      {...props}
    />
  );
}

export function Toaster() {
  return (
    <ToastProvider swipeDirection="right">
      <ToastViewport />
    </ToastProvider>
  );
}
