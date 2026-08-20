import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/config/server-env";
import type {
  TransactionalEmailProvider,
} from "@/lib/email/types";

const developmentProvider: TransactionalEmailProvider = {
  async send() {
    return {
      status: "sent",
      messageId: `development-${randomUUID()}`,
    };
  },
};

const resendProvider: TransactionalEmailProvider = {
  async send(message) {
    if (!serverEnv.RESEND_API_KEY || !serverEnv.TRANSACTIONAL_EMAIL_FROM) {
      return {
        status: "failed",
        code: "provider_not_configured",
        message: "The transactional email provider is not fully configured.",
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: serverEnv.TRANSACTIONAL_EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      return {
        status: "failed",
        code: `provider_http_${response.status}`,
        message: "The transactional email provider rejected the request.",
      };
    }

    const result = (await response.json()) as { id?: unknown };
    if (typeof result.id !== "string" || result.id.length === 0) {
      return {
        status: "failed",
        code: "provider_invalid_response",
        message: "The transactional email provider returned an invalid response.",
      };
    }

    return { status: "sent", messageId: result.id };
  },
};

export function getTransactionalEmailProvider() {
  return serverEnv.TRANSACTIONAL_EMAIL_PROVIDER === "resend"
    ? resendProvider
    : developmentProvider;
}
