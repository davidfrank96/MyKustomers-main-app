import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePrivilegedPlatformAdmin: vi.fn(),
  createServiceRoleClient: vi.fn(),
  deliverClaimedEmailEvent: vi.fn(),
  getProviderSelection: vi.fn(),
}));

vi.mock("@/lib/admin/server", () => {
  class PrivilegedPlatformAdminAuthorizationError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    PrivilegedPlatformAdminAuthorizationError,
    requirePrivilegedPlatformAdmin: mocks.requirePrivilegedPlatformAdmin,
  };
});
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));
vi.mock("@/lib/email/outbox", () => ({
  deliverClaimedEmailEvent: mocks.deliverClaimedEmailEvent,
}));
vi.mock("@/lib/email/provider", () => ({
  getTransactionalEmailProviderSelectionForName: mocks.getProviderSelection,
}));

import {
  PrivilegedPlatformAdminAuthorizationError,
} from "@/lib/admin/server";
import { retryFailedEmailAction } from "@/features/admin/email-retry-actions";

const eventId = "56017a2e-930f-4c11-a48a-1bac6b08c22a";
const adminId = "9fb5934b-cba1-4aa0-9e87-feb1c0e73842";
const attemptId = "5ee5fd6a-0322-4b1e-8e2c-06a4b956e38f";
const provider = { name: "brevo", send: vi.fn() };

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  return query;
}

function createService(
  { claimData, claimError }: { claimData?: unknown; claimError?: unknown } = {},
) {
  const eventQuery = queryResult({
    id: eventId,
    event_type: "BOOKING_CONFIRMED",
    status: "FAILED",
    attempt_count: 1,
    failure_code: "provider_http_429",
  });
  const attemptQuery = queryResult({
    attempt_number: 1,
    provider: "brevo",
    status: "FAILED",
    failure_code: "provider_http_429",
  });
  return {
    from: vi.fn((table: string) =>
      table === "email_events" ? eventQuery : attemptQuery,
    ),
    rpc: vi.fn(async () => ({
      data:
        claimData ??
        ({
          status: "CLAIMED",
          attempt_id: attemptId,
          attempt_number: 2,
          provider: "brevo",
        } as const),
      error: claimError,
    })),
  };
}

function reasonForm(value = "Retry after controlled Brevo rate limit.") {
  const form = new FormData();
  form.set("reason", value);
  return form;
}

describe("retryFailedEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrivilegedPlatformAdmin.mockResolvedValue({
      userId: adminId,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      assuranceLevel: "aal2",
    });
    mocks.getProviderSelection.mockReturnValue({
      name: "brevo",
      configured: true,
      provider,
    });
  });

  it("claims once through the pinned provider and reports provider acceptance", async () => {
    const service = createService();
    mocks.createServiceRoleClient.mockReturnValue(service);
    mocks.deliverClaimedEmailEvent.mockResolvedValue({ status: "sent" });

    await expect(
      retryFailedEmailAction(eventId, { status: "idle", message: null }, reasonForm()),
    ).resolves.toEqual({
      status: "success",
      message: "Delivery attempt accepted by provider.",
    });
    expect(service.rpc).toHaveBeenCalledWith("claim_platform_admin_email_retry", {
      p_email_event_id: eventId,
      p_admin_user_id: adminId,
      p_reason: "Retry after controlled Brevo rate limit.",
      p_expected_attempt_count: 1,
      p_expected_failure_code: "provider_http_429",
      p_expected_provider: "brevo",
    });
    expect(mocks.deliverClaimedEmailEvent).toHaveBeenCalledOnce();
    expect(mocks.deliverClaimedEmailEvent).toHaveBeenCalledWith({
      emailEventId: eventId,
      attemptId,
      provider,
    });
  });

  it("keeps a failed provider retry truthful and does not invoke a fallback", async () => {
    mocks.createServiceRoleClient.mockReturnValue(createService());
    mocks.deliverClaimedEmailEvent.mockResolvedValue({
      status: "failed",
      code: "provider_http_503",
    });

    await expect(
      retryFailedEmailAction(eventId, { status: "idle", message: null }, reasonForm()),
    ).resolves.toEqual({
      status: "error",
      message: "Delivery attempt failed. Review the updated safe failure category.",
    });
    expect(mocks.getProviderSelection).toHaveBeenCalledTimes(1);
    expect(mocks.getProviderSelection).toHaveBeenCalledWith("brevo");
    expect(mocks.deliverClaimedEmailEvent).toHaveBeenCalledOnce();
  });

  it("does not call a provider when the atomic claim is stale", async () => {
    mocks.createServiceRoleClient.mockReturnValue(
      createService({ claimData: { status: "STALE" } }),
    );

    await expect(
      retryFailedEmailAction(eventId, { status: "idle", message: null }, reasonForm()),
    ).resolves.toEqual({
      status: "error",
      message: "Retry was not started because the event or administrator state changed.",
    });
    expect(mocks.deliverClaimedEmailEvent).not.toHaveBeenCalled();
  });

  it("returns MFA_REQUIRED before reading or claiming the event", async () => {
    mocks.requirePrivilegedPlatformAdmin.mockRejectedValue(
      new PrivilegedPlatformAdminAuthorizationError("MFA_REQUIRED"),
    );

    await expect(
      retryFailedEmailAction(eventId, { status: "idle", message: null }, reasonForm()),
    ).resolves.toEqual({
      status: "mfa_required",
      message: "Additional verification required.",
    });
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.deliverClaimedEmailEvent).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(501)])(
    "rejects an invalid reason before reading event state",
    async (reason) => {
      await expect(
        retryFailedEmailAction(
          eventId,
          { status: "idle", message: null },
          reasonForm(reason),
        ),
      ).resolves.toMatchObject({ status: "error" });
      expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    },
  );
});
