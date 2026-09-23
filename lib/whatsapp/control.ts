import "server-only";
import {
  controlStatusSchema,
  qrSchema,
  type ControlAction,
  type GatewayResult,
} from "@/features/whatsapp/control-model";

// Strict reconstruction and bounded responses prevent provider data entering UI/errors.
export class WhatsAppControl {
  constructor(
    private base: string,
    private key: string,
    private transport: typeof fetch = fetch,
  ) {}
  private async request(path: string, body?: unknown) {
    const response = await this.transport(
      `${this.base}/internal/v1/control/session${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { "X-Control-Key": this.key, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status === 401 || response.status === 403) throw new Error("auth");
    if (!response.ok || !response.body) throw new Error("unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 45000) {
          await reader.cancel();
          throw new Error("unavailable");
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
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
  async status(): Promise<GatewayResult> {
    try {
      return { status: controlStatusSchema.parse(await this.request("")), error: null };
    } catch (error) {
      return {
        status: null,
        error:
          error instanceof Error && error.message === "auth"
            ? "Gateway authentication failed"
            : "Gateway unavailable",
      };
    }
  }
  async mutate(action: ControlAction, operationId: string) {
    // Never retry an uncertain control call. Gateway operation IDs are durable.
    try {
      await this.request("", { action, operationId });
      return true;
    } catch {
      return false;
    }
  }
  async qr() {
    try {
      return qrSchema.parse(await this.request("/qr"));
    } catch {
      return null;
    }
  }
}
export function getWhatsAppControl(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL_ENV === "preview") return null;
  try {
    const url = new URL(env.WA_AKG_BASE_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !/^[a-f0-9]{64}$/i.test(env.WA_AKG_CONTROL_API_KEY ?? "")
    )
      return null;
    return new WhatsAppControl(url.origin, env.WA_AKG_CONTROL_API_KEY!);
  } catch {
    return null;
  }
}
