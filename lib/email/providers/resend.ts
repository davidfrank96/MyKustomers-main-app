import "server-only";
import type { TransactionalEmailProvider } from "@/lib/email/types";
import {
  type EmailProviderFetch,
  isEmailProviderFailure,
  parseTransactionalEmailSender,
  providerHttpFailure,
  requestEmailProvider,
  safeProviderCorrelationHeaders,
} from "@/lib/email/providers/shared";

type ResendProviderOptions = {
  apiKey: string;
  from: string;
  fetchImpl?: EmailProviderFetch;
  timeoutMs?: number;
};

export function createResendEmailProvider({
  apiKey,
  from,
  fetchImpl = fetch,
  timeoutMs = 8_000,
}: ResendProviderOptions): TransactionalEmailProvider {
  const sender = parseTransactionalEmailSender(from);

  return {
    name: "resend",
    async send(message) {
      if (!apiKey || !sender) {
        return {
          status: "failed",
          code: "provider_not_configured",
          message: "The transactional email provider is not fully configured.",
        };
      }

      const response = await requestEmailProvider(
        fetchImpl,
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: from.trim(),
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: safeProviderCorrelationHeaders(message.headers),
          }),
        },
        timeoutMs,
      );

      if (isEmailProviderFailure(response)) return response;
      if (!response.ok) return providerHttpFailure(response.status);

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        return {
          status: "failed",
          code: "provider_invalid_response",
          message: "The transactional email provider returned an invalid response.",
        };
      }
      const id = (result as { id?: unknown })?.id;
      if (typeof id !== "string" || id.length === 0) {
        return {
          status: "failed",
          code: "provider_invalid_response",
          message: "The transactional email provider returned an invalid response.",
        };
      }
      return { status: "sent", messageId: id };
    },
  };
}
