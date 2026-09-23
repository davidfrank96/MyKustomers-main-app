import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rpc: vi.fn(),
  provider: vi.fn(),
  health: vi.fn(),
}));
vi.mock("@/lib/admin/server", () => ({ requirePlatformAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/whatsapp/provider", () => ({ getWhatsAppProvider: mocks.provider }));
import { WhatsAppAdminHealth } from "@/components/whatsapp/admin-health";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_ENABLED", "true");
  vi.stubEnv("WHATSAPP_PROVIDER", "wa_akg");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("WHATSAPP_PILOT_BUSINESS_IDS", "10000000-0000-4000-8000-000000000001");
  mocks.admin.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({
    data: { pending: 2, unknown: 1, failed_recently: 0 },
    error: null,
  });
  mocks.provider.mockReturnValue({ health: mocks.health });
  mocks.health.mockResolvedValue("CONNECTED");
});
afterEach(() => vi.unstubAllEnvs());
it("denies unauthorized users before storage and gateway calls", async () => {
  mocks.admin.mockRejectedValue(new Error("Denied"));
  await expect(WhatsAppAdminHealth()).rejects.toThrow("Denied");
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.health).not.toHaveBeenCalled();
});
it("shows aggregate evidence and connection without private provider fields", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      pending: 2,
      unknown: 1,
      failed_recently: 0,
      recipient: "PRIVATE_SENTINEL",
      provider_key: "PRIVATE_SENTINEL",
    },
    error: null,
  });
  const html = renderToStaticMarkup(await WhatsAppAdminHealth());
  expect(html).toContain("Enabled for pilot businesses");
  expect(html).toContain("Connected");
  expect(html).toContain("Unknown");
  expect(html).not.toContain("PRIVATE_SENTINEL");
});
it("distinguishes missing evidence and authorization failure from healthy", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE_SENTINEL" } });
  mocks.health.mockResolvedValue("AUTH_FAILURE");
  const html = renderToStaticMarkup(await WhatsAppAdminHealth());
  expect(html).toContain("Unavailable");
  expect(html).toContain("Authentication failed");
  expect(html).not.toContain("PRIVATE_SENTINEL");
});
