// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  business: vi.fn(),
  email: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect-success");
  },
}));
vi.mock("@/lib/auth/server", () => ({ requireCurrentBusiness: mocks.business }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeOutboundMessageRateLimit: vi.fn(),
}));
vi.mock("@/features/bookings/queries", () => ({ getBookingForBusiness: vi.fn() }));
vi.mock("@/features/customers/queries", () => ({
  findPotentialDuplicateCustomers: vi.fn(),
}));
vi.mock("@/lib/email/outbox", () => ({ deliverEmailEvent: mocks.email }));
vi.mock("@/lib/whatsapp/provider", () => ({ getWhatsAppProvider: mocks.provider }));
import { createBookingAction } from "@/features/bookings/actions";
const pilot = "10000000-0000-4000-8000-000000000001";
function form(channels = true) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    customerMode: "existing",
    customerId: "20000000-0000-4000-8000-000000000001",
    title: "Synthetic booking",
    currency: "EUR",
    totalAmount: "100",
    depositAmount: "0",
  }))
    result.set(key, value);
  if (channels)
    for (const [key, value] of Object.entries({
      communicationPreference: "true",
      emailEnabled: "on",
      whatsappEnabled: "on",
      whatsappRecipient: "+1 (555) 555-0123",
      whatsappConsent: "on",
    }))
      result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_ENABLED", "true");
  vi.stubEnv("WHATSAPP_PILOT_BUSINESS_IDS", pilot);
  vi.stubEnv("WHATSAPP_PROVIDER", "wa_akg");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.business.mockResolvedValue({ business: { id: pilot } });
  mocks.rpc.mockResolvedValue({
    data: [{ booking_id: "synthetic-booking" }],
    error: null,
  });
  mocks.provider.mockImplementation(() => {
    throw new Error("gateway unavailable");
  });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects a forged other-business selection before a write", async () => {
  mocks.business.mockResolvedValue({
    business: { id: "10000000-0000-4000-8000-000000000002" },
  });
  expect(await createBookingAction({ status: "idle" }, form())).toMatchObject({
    status: "error",
    message: "WhatsApp updates are unavailable for this business.",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires explicit consent before atomically creating anything", async () => {
  const data = form();
  data.delete("whatsappConsent");
  expect(await createBookingAction({ status: "idle" }, data)).toMatchObject({
    status: "error",
    fieldErrors: { whatsappConsent: expect.any(Array) },
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([true, false])(
  "persists the pilot choices independently of gateway availability (email=%s)",
  async (email) => {
    const data = form();
    if (!email) data.delete("emailEnabled");
    await expect(createBookingAction({ status: "idle" }, data)).rejects.toThrow(
      "redirect-success",
    );
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "create_booking_with_channels",
      expect.objectContaining({
        p_business_id: pilot,
        p_email_enabled: email,
        p_whatsapp_enabled: true,
        p_whatsapp_recipient: "+15555550123",
        p_whatsapp_consent: true,
      }),
    );
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  },
);
it("preserves the ordinary email workflow when the pilot is off", async () => {
  vi.stubEnv("WHATSAPP_ENABLED", "false");
  await expect(createBookingAction({ status: "idle" }, form(false))).rejects.toThrow(
    "redirect-success",
  );
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    "create_booking_with_customer",
    expect.objectContaining({ p_business_id: pilot }),
  );
  expect(mocks.provider).not.toHaveBeenCalled();
});
