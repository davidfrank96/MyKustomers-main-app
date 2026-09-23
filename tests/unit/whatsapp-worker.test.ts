// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/whatsapp/provider", () => ({ getWhatsAppProvider: mocks.provider }));
vi.mock("@/lib/config/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: "https://app.example.com" },
}));
import { processWhatsApp } from "@/features/whatsapp/worker";
const business = "10000000-0000-4000-8000-000000000001";
const event = {
  id: "event-id",
  business_id: business,
  lease_id: "lease-id",
  idempotency_key: "a".repeat(64),
};
const context = {
  event_type: "BOOKING_CONFIRMATION_REQUESTED",
  business_name: "Synthetic Vendor",
  booking_reference: "REF-TEST",
  recipient: "+15555550123",
  path_prefix: "c",
  token: "s".repeat(43),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("WHATSAPP_ENABLED", "true");
  vi.stubEnv("WHATSAPP_PILOT_BUSINESS_IDS", business);
  mocks.provider.mockReturnValue({ name: "wa_akg", sendText: mocks.send });
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_whatsapp_event"
        ? [event]
        : name === "get_whatsapp_dispatch_context"
          ? context
          : true,
    error: null,
  }));
  mocks.send.mockResolvedValue({ state: "ACCEPTED", providerMessageId: "provider-id" });
});
afterEach(() => vi.unstubAllEnvs());
it("kill switch causes no claim or provider calls and leaves pending intents paused", async () => {
  mocks.provider.mockReturnValue(null);
  vi.stubEnv("WHATSAPP_ENABLED", "false");
  expect(await processWhatsApp()).toMatchObject({ processed: 0, disabled: true });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("sends one claimed event with its exact capability and stable idempotency ID", async () => {
  expect(await processWhatsApp()).toMatchObject({ processed: 1, accepted: 1 });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    idempotencyKey: event.idempotency_key,
    recipient: context.recipient,
  });
  expect(mocks.send.mock.calls[0][0].text).toContain(
    `https://app.example.com/c/${context.token}`,
  );
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_whatsapp_event",
    expect.objectContaining({
      p_event_id: event.id,
      p_lease_id: event.lease_id,
      p_status: "ACCEPTED",
      p_retryable: false,
    }),
  );
});
it("rejects a forged claimed tenant without a send", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_whatsapp_event"
        ? [{ ...event, business_id: "10000000-0000-4000-8000-000000000002" }]
        : name === "get_whatsapp_dispatch_context"
          ? context
          : true,
    error: null,
  }));
  await processWhatsApp();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_whatsapp_event",
    expect.objectContaining({ p_status: "CANCELLED" }),
  );
});
it("preserves ambiguous provider-down outcomes without automatic resend", async () => {
  mocks.send.mockResolvedValue({
    state: "UNKNOWN",
    errorCode: "gateway_outcome_uncertain",
  });
  expect(await processWhatsApp()).toMatchObject({ unknown: 1, accepted: 0 });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "finish_whatsapp_event",
    expect.objectContaining({ p_status: "UNKNOWN", p_retryable: false }),
  );
});
it("cannot send after consent is disabled or capability context is revoked", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_whatsapp_event"
        ? [event]
        : name === "get_whatsapp_dispatch_context"
          ? null
          : true,
    error: null,
  }));
  await processWhatsApp();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("never retries provider acceptance after persistence fails", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_whatsapp_event"
        ? [event]
        : name === "get_whatsapp_dispatch_context"
          ? context
          : null,
    error: name === "finish_whatsapp_event" ? { message: "private DB details" } : null,
  }));
  await expect(processWhatsApp()).rejects.toThrow("WhatsApp worker storage unavailable");
  expect(mocks.send).toHaveBeenCalledTimes(1);
});
