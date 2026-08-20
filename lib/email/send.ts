import type {
  EmailProviderResult,
  TransactionalEmailMessage,
  TransactionalEmailProvider,
} from "@/lib/email/types";

export async function sendWithProviderBoundary(
  provider: TransactionalEmailProvider,
  message: TransactionalEmailMessage,
): Promise<EmailProviderResult> {
  try {
    return await provider.send(message);
  } catch {
    return {
      status: "failed",
      code: "provider_exception",
      message: "The transactional email provider request failed.",
    };
  }
}
