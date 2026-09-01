"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  buildCustomerConfirmationMessageText,
  buildCustomerConfirmationShareTitle,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  composeCustomerConfirmationShareMessage,
  type ConfirmationShareMethod,
} from "@/features/confirmation-links/share";
import { cn } from "@/lib/utils/cn";

type CustomerConfirmationShareProps = {
  businessName: string;
  customerName: string | null;
  confirmationUrl: string;
  recordShare: (method: ConfirmationShareMethod) => Promise<void>;
  initialMessage?: string;
  shareTitle?: string;
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  linkLabel?: string;
  messageHelp?: string;
  idPrefix?: string;
  triggerClassName?: string;
};

async function writeToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.append(fallback);
  fallback.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy was rejected.");
    }
  } finally {
    fallback.remove();
  }
}

function openExternalShare(url: string) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    return false;
  }

  popup.opener = null;
  popup.location.replace(url);
  return true;
}

export function CustomerConfirmationShare({
  businessName,
  customerName,
  confirmationUrl,
  recordShare,
  initialMessage: initialMessageOverride,
  shareTitle,
  triggerLabel = "Share with customer",
  dialogTitle = "Share with customer",
  dialogDescription = "Send a clear request so your customer knows who it is from and what to do.",
  linkLabel = "Confirmation link",
  messageHelp = "You can edit this message before sharing. The secure confirmation link will be included automatically.",
  idPrefix = "confirmation",
  triggerClassName,
}: CustomerConfirmationShareProps) {
  const initialMessage =
    initialMessageOverride ??
    buildCustomerConfirmationMessageText({
      businessName,
      customerName,
    });
  const [message, setMessage] = useState(initialMessage);
  const nativeShareAvailable = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [feedback, setFeedback] = useState<{
    title: string;
    description?: string;
  } | null>(null);

  async function track(method: ConfirmationShareMethod) {
    await recordShare(method).catch(() => undefined);
  }

  function showCopyError() {
    setFeedback({
      title: "Could not copy",
      description: "Select the text and copy it manually.",
    });
  }

  async function copyMessage() {
    try {
      await writeToClipboard(
        composeCustomerConfirmationShareMessage(message, confirmationUrl),
      );
      await track("copy_message");
      setFeedback({ title: "Message copied" });
    } catch {
      showCopyError();
    }
  }

  async function copyLink() {
    try {
      await writeToClipboard(confirmationUrl);
      await track("copy_link");
      setFeedback({ title: "Link copied" });
    } catch {
      showCopyError();
    }
  }

  function openShareDestination(method: "whatsapp" | "telegram", url: string) {
    if (!openExternalShare(url)) {
      setFeedback({
        title: "Sharing window blocked",
        description: "Allow pop-ups or use Copy message instead.",
      });
      return;
    }

    void track(method);
  }

  async function shareNatively() {
    if (typeof navigator.share !== "function") {
      return;
    }

    void track("native_share");

    try {
      await navigator.share({
        title: shareTitle ?? buildCustomerConfirmationShareTitle(businessName),
        text: message.trim(),
        url: confirmationUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFeedback({
        title: "Could not open sharing options",
        description: "Use WhatsApp, Telegram, or copy the message instead.",
      });
    }
  }

  return (
    <ToastProvider swipeDirection="right">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" className={cn("w-full sm:w-auto", triggerClassName)}>
            <Share2 className="size-4" aria-hidden="true" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor={`${idPrefix}-share-message`}
                className="text-sm font-medium"
              >
                Message
              </label>
              <Textarea
                id={`${idPrefix}-share-message`}
                value={message}
                maxLength={1200}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-36 resize-y"
              />
              <p className="text-xs leading-5 text-muted-foreground">{messageHelp}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor={`${idPrefix}-share-link`} className="text-sm font-medium">
                {linkLabel}
              </label>
              <input
                id={`${idPrefix}-share-link`}
                readOnly
                value={confirmationUrl}
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openShareDestination(
                    "whatsapp",
                    buildWhatsAppShareUrl(message, confirmationUrl),
                  )
                }
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openShareDestination(
                    "telegram",
                    buildTelegramShareUrl(message, confirmationUrl),
                  )
                }
              >
                <Send className="size-4" aria-hidden="true" />
                Telegram
              </Button>
              {nativeShareAvailable ? (
                <Button type="button" variant="secondary" onClick={shareNatively}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Share...
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={copyMessage}>
                <Copy className="size-4" aria-hidden="true" />
                Copy message
              </Button>
              <Button type="button" variant="ghost" onClick={copyLink}>
                <Check className="size-4" aria-hidden="true" />
                Copy link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ToastRoot
        open={feedback !== null}
        onOpenChange={(open) => {
          if (!open) setFeedback(null);
        }}
      >
        <ToastTitle className="font-medium">{feedback?.title}</ToastTitle>
        {feedback?.description ? (
          <ToastDescription className="mt-1 text-sm text-muted-foreground">
            {feedback.description}
          </ToastDescription>
        ) : null}
      </ToastRoot>
      <ToastViewport />
    </ToastProvider>
  );
}
