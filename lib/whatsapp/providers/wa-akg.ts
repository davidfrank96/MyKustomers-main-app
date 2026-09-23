import "server-only";
import type {
  WhatsAppProvider,
  WhatsAppProviderHealth,
  WhatsAppSendInput,
  WhatsAppSendResult,
} from "../types";

async function boundedJson(response: Response, limit: number): Promise<unknown> {
  if (!response.body) throw new Error("Missing gateway response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Gateway response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// A response body or thrown fetch error may contain private request context.
// Only these fixed, locally classified values cross the adapter boundary.
export class WaAkgProvider implements WhatsAppProvider {
  readonly name = "wa_akg";
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly sessionId: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  private request(path: string, init: RequestInit = {}) {
    return this.transport(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "X-API-Key": this.apiKey, "Content-Type": "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
  }
  async sendText(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    try {
      const response = await this.request("/internal/v1/messages/text", {
        method: "POST",
        body: JSON.stringify({
          clientMessageId: input.idempotencyKey,
          recipient: input.recipient,
          text: input.text,
        }),
      });
      if (response.status === 401 || response.status === 403)
        return { state: "FAILED", errorCode: "gateway_authorization", retryable: false };
      if (response.status === 400)
        return {
          state: "FAILED",
          errorCode: "gateway_request_rejected",
          retryable: false,
        };
      // The gateway and its Nginx limiter reject 429 before any provider call.
      if (response.status === 429)
        return { state: "FAILED", errorCode: "gateway_rate_limited", retryable: true };
      const body = await boundedJson(response, 2048);
      if (!body || typeof body !== "object")
        return { state: "UNKNOWN", errorCode: "gateway_invalid_response" };
      const result = body as Record<string, unknown>;
      if (
        response.status === 409 &&
        result.status === "NOT_ACCEPTED" &&
        result.code === "session_disconnected"
      )
        return { state: "FAILED", errorCode: "session_disconnected", retryable: true };
      if (
        response.status === 200 &&
        result.status === "ACCEPTED" &&
        typeof result.providerId === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/.test(result.providerId)
      )
        return { state: "ACCEPTED", providerMessageId: result.providerId };
      return { state: "UNKNOWN", errorCode: "gateway_outcome_uncertain" };
    } catch {
      // Even a network exception can occur after the server accepted the message.
      return { state: "UNKNOWN", errorCode: "gateway_outcome_uncertain" };
    }
  }
  async health(): Promise<WhatsAppProviderHealth> {
    try {
      const response = await this.request(
        `/v1/sessions/${encodeURIComponent(this.sessionId)}`,
      );
      if (response.status === 401 || response.status === 403) return "AUTH_FAILURE";
      if (!response.ok) return "UNREACHABLE";
      const body = await boundedJson(response, 4096);
      return body &&
        typeof body === "object" &&
        "status" in body &&
        body.status === "connected"
        ? "CONNECTED"
        : "DISCONNECTED";
    } catch {
      return "UNREACHABLE";
    }
  }
}
