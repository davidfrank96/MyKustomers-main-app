// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { WhatsAppControl, getWhatsAppControl } from "@/lib/whatsapp/control";
import { controlStatusSchema } from "@/features/whatsapp/control-model";
const status = {
  status: "CONNECTED",
  gateway: "healthy",
  database: "healthy",
  linked: true,
  account: { last4: "0123", jid: "PRIVATE_SENTINEL" },
  connectedSince: null,
  uptimeSeconds: 12,
  processUptimeSeconds: 20,
  reconnectAttempts: 0,
  paused: false,
  restricted: true,
  memory: { availableBytes: 100, totalBytes: 200, rssBytes: 10 },
  qr: "PRIVATE_SENTINEL",
};
it("reconstructs status without private fields or QR", async () => {
  const transport = vi.fn().mockResolvedValue(Response.json(status));
  const control = new WhatsAppControl(
    "https://gateway.example",
    "a".repeat(64),
    transport,
  );
  const result = await control.status();
  expect(result.error).toBeNull();
  expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
  expect(transport.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    headers: { "X-Control-Key": "a".repeat(64) },
  });
});
it.each([401, 403, 500])("sanitizes gateway failure %s", async (code) => {
  const control = new WhatsAppControl(
    "https://gateway.example",
    "secret",
    vi.fn().mockResolvedValue(new Response("PRIVATE_SENTINEL", { status: code })),
  );
  expect(JSON.stringify(await control.status())).not.toContain("PRIVATE_SENTINEL");
  expect((await control.status()).error).not.toBeNull();
});
it("bounds responses and never retries uncertain mutation", async () => {
  const transport = vi.fn().mockRejectedValue(new Error("PRIVATE_SENTINEL"));
  const control = new WhatsAppControl("https://gateway.example", "secret", transport);
  expect(await control.mutate("replace", "operation")).toBe(false);
  expect(transport).toHaveBeenCalledTimes(1);
  const huge = new WhatsAppControl(
    "https://gateway.example",
    "secret",
    vi.fn().mockResolvedValue(new Response("x".repeat(50000))),
  );
  expect((await huge.status()).error).toBe("Gateway unavailable");
});
it("fails closed for Preview, insecure URLs and malformed identity", () => {
  expect(
    getWhatsAppControl({
      VERCEL_ENV: "preview",
      WA_AKG_BASE_URL: "https://gateway.example",
      WA_AKG_CONTROL_API_KEY: "a".repeat(64),
    }),
  ).toBeNull();
  expect(
    getWhatsAppControl({
      WA_AKG_BASE_URL: "http://gateway.example",
      WA_AKG_CONTROL_API_KEY: "a".repeat(64),
    }),
  ).toBeNull();
  expect(
    controlStatusSchema.safeParse({ ...status, account: { last4: "15555550123" } })
      .success,
  ).toBe(false);
});
