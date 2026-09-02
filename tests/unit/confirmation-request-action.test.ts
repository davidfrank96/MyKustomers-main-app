import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentBusiness: vi.fn(),
  createClient: vi.fn(),
  deliverEmailEvent: vi.fn(),
  revalidatePath: vi.fn(),
  consumeOutboundMessageRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/server", () => ({
  requireCurrentBusiness: mocks.requireCurrentBusiness,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({
  canUseServiceRoleClient: vi.fn(() => false),
  createServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/email/outbox", () => ({
  deliverEmailEvent: mocks.deliverEmailEvent,
}));
vi.mock("@/lib/config/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: "https://app.example.com" },
}));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeOutboundMessageRateLimit: mocks.consumeOutboundMessageRateLimit,
}));

import { sendConfirmationEmailAction } from "@/features/confirmation-links/actions";
import { initialConfirmationLinkActionState } from "@/features/confirmation-links/action-state";

const bookingId = "00000000-0000-4000-8000-000000000001";

function recipientForm(email: string) {
  const form = new FormData();
  form.set("recipientEmail", email);
  return form;
}

function requestResult(overrides: Record<string, unknown> = {}) {
  return {
    confirmation_link_id: "00000000-0000-4000-8000-000000000002",
    email_event_id: "00000000-0000-4000-8000-000000000003",
    recipient_email: "David.Frank@hotmail.com",
    expires_at: "2026-09-02T12:00:00.000Z",
    replaced_link_count: 0,
    request_status: "created",
    ...overrides,
  };
}

describe("sendConfirmationEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentBusiness.mockResolvedValue({
      user: { id: "user-1" },
      business: { id: "business-1" },
    });
    mocks.consumeOutboundMessageRateLimit.mockResolvedValue({
      status: "allowed",
      remainingRequests: 2,
      retryAfterSeconds: 0,
      resetAt: null,
    });
  });

  it("rejects malformed email before creating link or outbox evidence", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await sendConfirmationEmailAction(
      bookingId,
      initialConfirmationLinkActionState,
      recipientForm("not-an-email"),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { recipientEmail: ["Enter a valid customer email."] },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.deliverEmailEvent).not.toHaveBeenCalled();
  });

  it("normalizes only the domain and reports provider acceptance honestly", async () => {
    const rpc = vi.fn(async () => ({ data: [requestResult()], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });
    mocks.deliverEmailEvent.mockResolvedValue({ status: "sent" });

    const result = await sendConfirmationEmailAction(
      bookingId,
      initialConfirmationLinkActionState,
      recipientForm("  David.Frank@HOTMAIL.COM  "),
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_booking_confirmation_request",
      expect.objectContaining({
        p_booking_id: bookingId,
        p_contact_email: "David.Frank@hotmail.com",
        p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(mocks.deliverEmailEvent).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000003",
      undefined,
      { confirmationUrl: expect.stringMatching(/^https:\/\/app\.example\.com\/c\//) },
    );
    expect(result).toMatchObject({
      status: "success",
      recipientEmail: "David.Frank@hotmail.com",
      deliveryStatus: "accepted",
      message: "Email accepted for delivery to David.Frank@hotmail.com.",
    });
  });

  it("does not reconstruct or resend a duplicate request", async () => {
    const rpc = vi.fn(async () => ({
      data: [requestResult({ request_status: "duplicate_ignored" })],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await sendConfirmationEmailAction(
      bookingId,
      initialConfirmationLinkActionState,
      recipientForm("David.Frank@Hotmail.com"),
    );

    expect(result).toMatchObject({ status: "success", deliveryStatus: "duplicate" });
    expect(mocks.deliverEmailEvent).not.toHaveBeenCalled();
  });

  it("keeps the durable request and reports a failed acceptance without claiming send", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: [requestResult()], error: null })),
    });
    mocks.deliverEmailEvent.mockResolvedValue({
      status: "failed",
      code: "provider_http_503",
    });

    const result = await sendConfirmationEmailAction(
      bookingId,
      initialConfirmationLinkActionState,
      recipientForm("David.Frank@hotmail.com"),
    );

    expect(result).toMatchObject({
      status: "error",
      deliveryStatus: "failed",
      confirmationLinkId: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.message).toContain("was not accepted for delivery");
  });

  it("fails closed before creating durable delivery work when protection is unavailable", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });
    mocks.consumeOutboundMessageRateLimit.mockResolvedValue({
      status: "unavailable",
      remainingRequests: null,
      retryAfterSeconds: 0,
      resetAt: null,
    });

    const result = await sendConfirmationEmailAction(
      bookingId,
      initialConfirmationLinkActionState,
      recipientForm("David.Frank@hotmail.com"),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Customer message protection is temporarily unavailable. Nothing was sent.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.deliverEmailEvent).not.toHaveBeenCalled();
  });
});
