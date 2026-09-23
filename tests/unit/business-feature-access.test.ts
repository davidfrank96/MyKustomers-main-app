// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }),
    }),
    rpc: mocks.rpc,
  }),
}));
import { hasBusinessFeature } from "@/features/business-features/server";
import { getWhatsAppAccess } from "@/features/whatsapp/access";
const business = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_ENABLED", "true");
  vi.stubEnv("WHATSAPP_PROVIDER", "wa_akg");
  vi.stubEnv("WHATSAPP_PILOT_BUSINESS_IDS", business);
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.read.mockResolvedValue({ data: { enabled: true }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  { data: null, error: null },
  { data: { enabled: false }, error: null },
  { data: null, error: { message: "offline" } },
])("fails closed for missing, disabled or unavailable entitlement", async (result) => {
  mocks.read.mockResolvedValue(result);
  expect(await hasBusinessFeature(business, "WHATSAPP_CUSTOMER_UPDATES")).toBe(false);
  expect(await getWhatsAppAccess(business)).toEqual({
    entitled: false,
    available: false,
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires entitlement and operational rollout together", async () => {
  expect(await getWhatsAppAccess(business)).toEqual({ entitled: true, available: true });
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect(await getWhatsAppAccess(business)).toEqual({ entitled: true, available: false });
  mocks.rpc.mockResolvedValue({ data: true, error: { message: "offline" } });
  expect(await getWhatsAppAccess(business)).toEqual({ entitled: true, available: false });
});
it("kill switch overrides entitlement without querying rollout", async () => {
  vi.stubEnv("WHATSAPP_ENABLED", "false");
  expect(await getWhatsAppAccess(business)).toEqual({ entitled: true, available: false });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
