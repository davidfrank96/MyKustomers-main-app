// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { whatsappConfig, whatsappAvailable } from "@/lib/whatsapp/config";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { WaAkgProvider } from "@/lib/whatsapp/providers/wa-akg";
import {
  communicationPreferenceSchema,
  e164Schema,
} from "@/features/whatsapp/validation";
import { renderWhatsAppMessage, whatsappEventTypes } from "@/features/whatsapp/templates";
const pilot = "10000000-0000-4000-8000-000000000001";
const env = {
  WHATSAPP_ENABLED: "true",
  WHATSAPP_PROVIDER: "wa_akg",
  WHATSAPP_PILOT_BUSINESS_IDS: pilot,
  WA_AKG_BASE_URL: "https://gateway.example.com",
  WA_AKG_API_KEY: "a".repeat(64),
  WA_AKG_SESSION_ID: "test",
};
const input = {
  intentId: "event",
  idempotencyKey: "b".repeat(64),
  recipient: "+15555550123",
  text: "Synthetic text",
};
afterEach(() => vi.unstubAllEnvs());
describe("WhatsApp channel authorization and input", () => {
  it("fails closed by default, for Preview, malformed allowlists and unknown providers", () => {
    expect(whatsappConfig({}).enabled).toBe(false);
    expect(getWhatsAppProvider({ ...env, WHATSAPP_ENABLED: "false" })).toBeNull();
    expect(getWhatsAppProvider({ ...env, VERCEL_ENV: "preview" })).toBeNull();
    expect(
      getWhatsAppProvider({ ...env, WHATSAPP_PILOT_BUSINESS_IDS: `${pilot},invalid` }),
    ).toBeNull();
    expect(getWhatsAppProvider({ ...env, WHATSAPP_PROVIDER: "meta_cloud" })).toBeNull();
    expect(getWhatsAppProvider(env)?.name).toBe("wa_akg");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    expect(whatsappAvailable(pilot)).toBe(true);
    expect(whatsappAvailable("10000000-0000-4000-8000-000000000002")).toBe(false);
  });
  it("requires HTTPS and rejects URL credentials, paths, query strings, fragments and invalid keys", () => {
    for (const url of [
      "http://gateway.example.com",
      "https://user:pass@gateway.example.com",
      "https://gateway.example.com/api",
      "https://gateway.example.com/?secret=x",
      "https://gateway.example.com/#x",
    ])
      expect(getWhatsAppProvider({ ...env, WA_AKG_BASE_URL: url })).toBeNull();
    expect(getWhatsAppProvider({ ...env, WA_AKG_API_KEY: "bad" })).toBeNull();
  });
  it("normalizes only explicit international formatting and requires consent and a channel", () => {
    expect(e164Schema.parse(" +1 (555) 555-0123 ")).toBe("+15555550123");
    for (const number of [
      "05555550123",
      "003531234567",
      "+0123456789",
      "+123",
      "+15555550123 ext 2",
      "+1555555012345678",
    ])
      expect(e164Schema.safeParse(number).success).toBe(false);
    expect(
      communicationPreferenceSchema.safeParse({
        emailEnabled: false,
        whatsappEnabled: false,
        consent: false,
      }).success,
    ).toBe(false);
    expect(
      communicationPreferenceSchema.safeParse({
        emailEnabled: true,
        whatsappEnabled: true,
        recipient: input.recipient,
        consent: false,
      }).success,
    ).toBe(false);
    expect(
      communicationPreferenceSchema.safeParse({
        emailEnabled: false,
        whatsappEnabled: true,
        recipient: input.recipient,
        consent: true,
      }).success,
    ).toBe(true);
    expect(
      communicationPreferenceSchema.safeParse({
        emailEnabled: true,
        whatsappEnabled: false,
        consent: false,
      }).success,
    ).toBe(true);
  });
  it.each(whatsappEventTypes)(
    "renders concise business-owned %s without money or private notes",
    (eventType) => {
      const token = "synthetic-token";
      const url = `https://app.example.com/c/${token}`;
      const text = renderWhatsAppMessage({
        eventType,
        businessName: "Synthetic Vendor",
        bookingReference: "REF-TEST",
        capabilityUrl: url,
      });
      expect(text).toContain("Synthetic Vendor");
      expect(text).toContain("REF-TEST");
      expect(text.split(url)).toHaveLength(2);
      expect(text).toContain("Powered by My Kustomers");
      expect(text.length).toBeLessThan(1000);
    },
  );
});
describe("WA-AKG protocol and evidence", () => {
  const adapter = (status: number, body: unknown) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(body), { status }));
    return {
      transport,
      provider: new WaAkgProvider(
        env.WA_AKG_BASE_URL,
        env.WA_AKG_API_KEY,
        env.WA_AKG_SESSION_ID,
        transport,
      ),
    };
  };
  it("sends a stable ID with server-only authorization and reports acceptance without inventing delivery", async () => {
    const { provider, transport } = adapter(200, {
      status: "ACCEPTED",
      providerId: "provider-1",
    });
    expect(await provider.sendText(input)).toEqual({
      state: "ACCEPTED",
      providerMessageId: "provider-1",
    });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/internal/v1/messages/text");
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(options?.body))).toEqual({
      clientMessageId: input.idempotencyKey,
      recipient: input.recipient,
      text: input.text,
    });
    expect(url).not.toContain(env.WA_AKG_API_KEY);
  });
  it.each([401, 403, 400])(
    "does not retry permanent HTTP %i rejection",
    async (status) => {
      expect(await adapter(status, {}).provider.sendText(input)).toMatchObject({
        state: "FAILED",
        retryable: false,
      });
    },
  );
  it("retries only proven pre-send rejection", async () => {
    expect(await adapter(429, {}).provider.sendText(input)).toMatchObject({
      state: "FAILED",
      retryable: true,
    });
    expect(
      await adapter(409, {
        status: "NOT_ACCEPTED",
        code: "session_disconnected",
      }).provider.sendText(input),
    ).toMatchObject({ state: "FAILED", retryable: true });
  });
  it.each([202, 409, 500, 502, 503])(
    "keeps ambiguous HTTP %i terminal UNKNOWN",
    async (status) => {
      expect(
        await adapter(status, {
          status: "UNKNOWN",
          recipient: input.recipient,
          body: input.text,
        }).provider.sendText(input),
      ).toEqual({ state: "UNKNOWN", errorCode: "gateway_outcome_uncertain" });
    },
  );
  it("does not leak network exceptions, tokens, phones or raw provider bodies", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error(`${input.recipient} ${input.text} ${env.WA_AKG_API_KEY}`),
      );
    const provider = new WaAkgProvider(
      env.WA_AKG_BASE_URL,
      env.WA_AKG_API_KEY,
      "test",
      transport,
    );
    expect(await provider.sendText(input)).toEqual({
      state: "UNKNOWN",
      errorCode: "gateway_outcome_uncertain",
    });
  });
  it("cancels oversized streamed responses without retaining a body", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4097));
      },
      cancel,
    });
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    const provider = new WaAkgProvider(
      env.WA_AKG_BASE_URL,
      env.WA_AKG_API_KEY,
      "test",
      transport,
    );
    expect(await provider.sendText(input)).toEqual({
      state: "UNKNOWN",
      errorCode: "gateway_outcome_uncertain",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("separates connection, authentication and server availability", async () => {
    expect(await adapter(200, { status: "connected" }).provider.health()).toBe(
      "CONNECTED",
    );
    expect(await adapter(200, { status: "reconnecting" }).provider.health()).toBe(
      "DISCONNECTED",
    );
    expect(await adapter(401, {}).provider.health()).toBe("AUTH_FAILURE");
    expect(await adapter(503, {}).provider.health()).toBe("UNREACHABLE");
  });
});
