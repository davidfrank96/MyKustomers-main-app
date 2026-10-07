// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  business: vi.fn(),
  email: vi.fn(),
  provider: vi.fn(),
  access: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/features/whatsapp/access", () => ({ getWhatsAppAccess: mocks.access }));
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
  consumeOutboundMessageRateLimit: mocks.rate,
}));
vi.mock("@/features/bookings/queries", () => ({ getBookingForBusiness: vi.fn() }));
vi.mock("@/features/customers/queries", () => ({
  findPotentialDuplicateCustomers: vi.fn(),
}));
vi.mock("@/lib/email/outbox", () => ({ deliverEmailEvent: mocks.email }));
vi.mock("@/lib/whatsapp/provider", () => ({ getWhatsAppProvider: mocks.provider }));
import {
  createBookingAction,
  rescheduleBookingAction,
} from "@/features/bookings/actions";
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
  mocks.access.mockImplementation(async (id) => ({
    entitled: id === pilot,
    available: id === pilot && process.env.WHATSAPP_ENABLED === "true",
  }));
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

it("rejects revoked access even when the browser omits the channel marker", async () => {
  mocks.access.mockResolvedValue({ entitled: false, available: false });
  const data = form();
  data.delete("communicationPreference");
  expect(await createBookingAction({ status: "idle" }, data)).toMatchObject({
    status: "error",
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("still creates an Email-only booking after entitlement revocation", async () => {
  mocks.access.mockResolvedValue({ entitled: false, available: false });
  const data = form();
  data.delete("whatsappEnabled");
  await expect(createBookingAction({ status: "idle" }, data)).rejects.toThrow(
    "redirect-success",
  );
  expect(mocks.rpc).toHaveBeenCalledWith(
    "create_booking_with_customer",
    expect.any(Object),
  );
});

it.each(["limited", "unavailable"])(
  "reschedule remains fail-closed when outbound protection is %s",
  async (status) => {
    mocks.business.mockResolvedValue({ business: { id: pilot }, user: { id: "vendor" } });
    mocks.rate.mockResolvedValue({ status, retryAfterSeconds: 60 });
    const data = new FormData();
    data.set("scheduledFor", new Date(Date.now() + 86400000).toISOString());
    const result = await rescheduleBookingAction("booking", { status: "idle" }, data);
    expect(result.status).toBe("error");
    expect(result.message).toContain("Nothing was sent.");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  },
);

it.each([true, false])(
  "reschedule uses the existing channel-aware=%s wrapper",
  async (pilotEnabled) => {
    const id = pilotEnabled ? pilot : "10000000-0000-4000-8000-000000000002";
    mocks.business.mockResolvedValue({ business: { id }, user: { id: "vendor" } });
    mocks.rate.mockResolvedValue({ status: "allowed" });
    mocks.rpc.mockResolvedValue({
      data: [{ booking_id: "booking", status: "READY", email_event_id: null }],
      error: null,
    });
    const data = new FormData();
    data.set("scheduledFor", new Date(Date.now() + 86400000).toISOString());
    const result = await rescheduleBookingAction("booking", { status: "idle" }, data);
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith(
      pilotEnabled
        ? "reschedule_booking_with_notification_with_channels"
        : "reschedule_booking_with_notification",
      expect.objectContaining({ p_booking_id: "booking" }),
    );
    expect(mocks.email).not.toHaveBeenCalled();
  },
);
