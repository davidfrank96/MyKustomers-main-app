import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  canUseServiceRoleClient: () => true,
  createServiceRoleClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/features/confirmation-links/rate-limit", () => ({
  consumeConfirmationRateLimit: async () => true,
}));
vi.mock("@/lib/email/outbox", () => ({ deliverEmailEvent: mocks.send }));
import { confirmPublicBooking } from "@/features/confirmation-links/public";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({
    data: { status: "confirmed", email_event_id: "durable-event" },
    error: null,
  });
});
it.each([
  ["David.Frank+Cake@HOTMAIL.COM", "David.Frank+Cake@hotmail.com"],
  ["Jane.Doe@Company.CO.UK", "Jane.Doe@company.co.uk"],
  ["  Customer+Order@Example.IE  ", "Customer+Order@example.ie"],
])(
  "passes immutable contact to the existing RPC without profile writes: %s",
  async (input, expected) => {
    await expect(
      confirmPublicBooking("a".repeat(43), { contactEmail: input }),
    ).resolves.toEqual({ status: "confirmed" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "confirm_booking_by_token_hash",
      expect.objectContaining({ p_contact_email: expected }),
    );
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("durable-event");
  },
);
