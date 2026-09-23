import "server-only";

export type WhatsAppSendInput = {
  intentId: string;
  idempotencyKey: string;
  recipient: string;
  text: string;
};
export type WhatsAppSendResult =
  | { state: "ACCEPTED"; providerMessageId: string }
  | { state: "FAILED"; errorCode: string; retryable: boolean }
  | { state: "UNKNOWN"; errorCode: string };
export type WhatsAppProviderHealth =
  "CONNECTED" | "DISCONNECTED" | "UNREACHABLE" | "AUTH_FAILURE";
export interface WhatsAppProvider {
  readonly name: string;
  sendText(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
  health(): Promise<WhatsAppProviderHealth>;
}
