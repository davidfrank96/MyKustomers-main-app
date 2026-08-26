import "server-only";
import type { TransactionalEmailProvider } from "@/lib/email/types";
import {
  deterministicProviderUuid,
  type EmailProviderFetch,
  isEmailProviderFailure,
  parseTransactionalEmailSender,
  providerHttpFailure,
  requestEmailProvider,
  safeProviderCorrelationHeaders,
} from "@/lib/email/providers/shared";

type BrevoProviderOptions = {
  apiKey: string;
  from: string;
  fetchImpl?: EmailProviderFetch;
  timeoutMs?: number;
};

export function createBrevoEmailProvider({
  apiKey,
  from,
  fetchImpl = fetch,
  timeoutMs = 8_000,
}: BrevoProviderOptions): TransactionalEmailProvider {
  const sender = parseTransactionalEmailSender(from);

  return {
    name: "brevo",
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
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender,
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
            headers: {
              ...safeProviderCorrelationHeaders(message.headers),
              idempotencyKey: deterministicProviderUuid(message.idempotencyKey),
            },
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
      const messageId = (result as { messageId?: unknown })?.messageId;
      if (typeof messageId !== "string" || messageId.length === 0) {
        return {
          status: "failed",
          code: "provider_invalid_response",
          message: "The transactional email provider returned an invalid response.",
        };
      }
      return { status: "sent", messageId };
    },
  };
}
