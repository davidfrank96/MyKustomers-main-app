"use client";

import {
  Copy,
  Files,
  Link,
  MessageCircle,
  Pencil,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import styles from "./secure-share-content.module.css";

export type SecureSharePresentation = "feedback" | "confirmation";

type SecureShareContentProps = {
  variant: SecureSharePresentation;
  title: string;
  description: string;
  message: string;
  messageHelp: string;
  maxMessageLength: number;
  linkLabel: string;
  secureUrl: string;
  idPrefix: string;
  nativeShareAvailable: boolean;
  onMessageChange: (message: string) => void;
  onWhatsApp: () => void;
  onTelegram: () => void;
  onNativeShare: () => void;
  onCopyMessage: () => void;
  onCopyLink: () => void;
};

function ShareAction({
  label,
  icon,
  onClick,
  iconClassName,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  iconClassName?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={styles.shareAction}
      onClick={onClick}
    >
      <span className={cn(styles.actionIcon, iconClassName)} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.actionLabel}>{label}</span>
    </Button>
  );
}

// Presentation only. The caller retains its message state, URL and existing
// channel/clipboard/evidence handlers; this component never creates or fetches links.
export function SecureShareContent(props: SecureShareContentProps) {
  const ContextIcon = props.variant === "feedback" ? MessageCircle : ShieldCheck;
  const messageId = `${props.idPrefix}-share-message`;
  const linkId = `${props.idPrefix}-share-link`;
  const helperId = `${props.idPrefix}-share-help`;
  return (
    <DialogContent
      className={styles.content}
      showCloseButton={false}
      data-secure-share={props.variant}
      aria-modal="true"
    >
      <div className={styles.header}>
        <span className={styles.contextIcon} aria-hidden="true">
          <ContextIcon />
        </span>
        <DialogTitle className={styles.title}>{props.title}</DialogTitle>
        <DialogDescription className={styles.description}>
          {props.description}
        </DialogDescription>
      </div>
      <DialogClose asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.closeButton}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </Button>
      </DialogClose>

      <div className={styles.body}>
        <div>
          <div className={styles.fieldHeading}>
            <label htmlFor={messageId}>Message</label>
            <span
              className={styles.counter}
              aria-label={`${props.message.length} of ${props.maxMessageLength} characters`}
            >
              {props.message.length}/{props.maxMessageLength}
            </span>
          </div>
          <Textarea
            id={messageId}
            value={props.message}
            maxLength={props.maxMessageLength}
            onChange={(event) => props.onMessageChange(event.target.value)}
            rows={5}
            aria-describedby={helperId}
            className={styles.messageInput}
          />
          <p id={helperId} className={styles.messageHelp}>
            <Pencil aria-hidden="true" />
            <span>{props.messageHelp}</span>
          </p>
        </div>

        <div className={styles.linkCard}>
          <div className={styles.linkHeading}>
            <Link aria-hidden="true" />
            <div>
              <label htmlFor={linkId} className={styles.linkLabel}>
                {props.linkLabel}
              </label>
              <p>
                {props.variant === "feedback"
                  ? "This link is private and does not require an account."
                  : "Your customer can securely review and confirm the booking."}
              </p>
            </div>
          </div>
          <div className={styles.linkField} data-secure-share-link>
            <input id={linkId} readOnly value={props.secureUrl} spellCheck={false} />
            <Button
              type="button"
              variant="ghost"
              className={styles.copyButton}
              aria-label={`Copy ${props.variant} link`}
              onClick={props.onCopyLink}
            >
              <Copy aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div>
          <h3 className={styles.sectionTitle}>Share via</h3>
          <div
            className={cn(
              styles.actions,
              props.nativeShareAvailable && styles.fiveActions,
            )}
          >
            <ShareAction
              label="WhatsApp"
              onClick={props.onWhatsApp}
              iconClassName={styles.whatsapp}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.7A8.5 8.5 0 1 1 20.5 11.7Z" />
                  <path
                    d="m8.3 7.5 1.4 2.8-1 1.1c.7 1.6 1.8 2.7 3.5 3.4l1-1 2.9 1.4c-.4 1.5-1.4 2-2.7 1.7-3.8-.9-6.6-3.7-7.2-6.7-.3-1.4.4-2.3 2.1-2.7Z"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              }
            />
            <ShareAction
              label="Telegram"
              onClick={props.onTelegram}
              iconClassName={styles.telegram}
              icon={<Send />}
            />
            {props.nativeShareAvailable ? (
              <ShareAction
                label="Share..."
                onClick={props.onNativeShare}
                icon={<Upload />}
              />
            ) : null}
            <ShareAction
              label="Copy message"
              onClick={props.onCopyMessage}
              icon={<Files />}
            />
            <ShareAction label="Copy link" onClick={props.onCopyLink} icon={<Link />} />
          </div>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="ghost" className={styles.bottomClose}>
            Close
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  );
}
