import "server-only";
import { serverEnv } from "@/lib/config/server-env";
import { createBrevoEmailProvider } from "@/lib/email/providers/brevo";
import { developmentEmailProvider } from "@/lib/email/providers/development";
import { createResendEmailProvider } from "@/lib/email/providers/resend";
import { parseTransactionalEmailSender } from "@/lib/email/providers/shared";
import type {
  TransactionalEmailProvider,
  TransactionalEmailProviderName,
} from "@/lib/email/types";

export type TransactionalEmailProviderConfig = {
  provider: string;
  brevoApiKey?: string;
  resendApiKey?: string;
  from?: string;
};

export type TransactionalEmailProviderSelection = {
  name: TransactionalEmailProviderName | "unsupported";
  label: "Development" | "Brevo" | "Resend" | "Unsupported";
  external: boolean;
  configured: boolean;
  provider: TransactionalEmailProvider;
};

type ProviderDependencies = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function unavailableEmailProvider(): TransactionalEmailProvider {
  return {
    name: "unavailable",
    async send() {
      return {
        status: "failed",
        code: "provider_not_configured",
        message: "The transactional email provider is not fully configured.",
      };
    },
  };
}

export function resolveTransactionalEmailProvider(
  config: TransactionalEmailProviderConfig,
  dependencies: ProviderDependencies = {},
): TransactionalEmailProviderSelection {
  if (config.provider === "development") {
    return {
      name: "development",
      label: "Development",
      external: false,
      configured: true,
      provider: developmentEmailProvider,
    };
  }

  const senderConfigured = Boolean(parseTransactionalEmailSender(config.from));

  if (config.provider === "brevo") {
    const configured = Boolean(config.brevoApiKey && senderConfigured);
    return {
      name: "brevo",
      label: "Brevo",
      external: true,
      configured,
      provider: configured
        ? createBrevoEmailProvider({
            apiKey: config.brevoApiKey!,
            from: config.from!,
            ...dependencies,
          })
        : unavailableEmailProvider(),
    };
  }

  if (config.provider === "resend") {
    const configured = Boolean(config.resendApiKey && senderConfigured);
    return {
      name: "resend",
      label: "Resend",
      external: true,
      configured,
      provider: configured
        ? createResendEmailProvider({
            apiKey: config.resendApiKey!,
            from: config.from!,
            ...dependencies,
          })
        : unavailableEmailProvider(),
    };
  }

  return {
    name: "unsupported",
    label: "Unsupported",
    external: true,
    configured: false,
    provider: unavailableEmailProvider(),
  };
}

export function getTransactionalEmailProviderSelection() {
  return resolveTransactionalEmailProvider({
    provider: serverEnv.TRANSACTIONAL_EMAIL_PROVIDER,
    brevoApiKey: serverEnv.BREVO_API_KEY,
    resendApiKey: serverEnv.RESEND_API_KEY,
    from: serverEnv.TRANSACTIONAL_EMAIL_FROM,
  });
}

export function getTransactionalEmailProvider() {
  return getTransactionalEmailProviderSelection().provider;
}
