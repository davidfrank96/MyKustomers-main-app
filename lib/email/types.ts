export type TransactionalEmailMessage = {
  idempotencyKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProviderResult =
  | { status: "sent"; messageId: string }
  | { status: "failed"; code: string; message: string };

export type TransactionalEmailProviderName = "development" | "brevo" | "resend";

export interface TransactionalEmailProvider {
  readonly name: TransactionalEmailProviderName | "unavailable";
  send(message: TransactionalEmailMessage): Promise<EmailProviderResult>;
}
