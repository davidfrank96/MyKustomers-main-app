import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/config/server-env", () => ({
  serverEnv: { BREVO_WEBHOOK_SECRET: "controlled-webhook-secret-".padEnd(64, "x") },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));

import { POST } from "@/app/api/webhooks/brevo/transactional/route";

const secret = "controlled-webhook-secret-".padEnd(64, "x");
const basePayload = {
  event: "delivered",
  "message-id": "controlled-message@relay.example",
  ts_event: Math.floor(Date.now() / 1000),
  "X-Mailin-custom": `mk-attempt-v1:${"a".repeat(64)}`,
  email: "must-not-cross-the-boundary@example.com",
  subject: "Must not cross the boundary",
};

function request(body: unknown = basePayload, headers: Record<string, string> = {}) {
  return new Request("https://mykustomers.com/api/webhooks/brevo/transactional", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("Brevo transactional webhook boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: "RECORDED", error: null });
  });

  it.each([undefined, "", "Basic nope", "Bearer wrong", "Bearer two tokens"])(
    "rejects malformed or incorrect authorization before database work",
    async (authorization) => {
      const response = await POST(
        request("not-json", {
          authorization: authorization ?? "",
          "content-type": "text/plain",
        }),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["delivered", "DELIVERED"],
    ["deferred", "DEFERRED"],
    ["soft_bounce", "SOFT_BOUNCED"],
    ["hard_bounce", "HARD_BOUNCED"],
    ["invalid_email", "INVALID"],
    ["blocked", "BLOCKED"],
    ["spam", "COMPLAINT"],
    ["error", "PROVIDER_ERROR"],
  ])("projects %s into minimized %s evidence", async (event, normalized) => {
    const response = await POST(request({ ...basePayload, event }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("ingest_brevo_transactional_event", {
      p_message_id: basePayload["message-id"],
      p_event_type: normalized,
      p_event_epoch: basePayload.ts_event,
      p_correlation_key: "a".repeat(64),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(basePayload.email);
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(basePayload.subject);
  });

  it("accepts duplicates and rejects correlation conflicts without leaking evidence", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "DUPLICATE", error: null });
    const duplicate = await POST(request());
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ result: "accepted" });

    mocks.rpc.mockResolvedValueOnce({ data: "CORRELATION_CONFLICT", error: null });
    const conflict = await POST(request());
    expect(conflict.status).toBe(400);
    expect(await conflict.json()).toEqual({ result: "correlation_rejected" });
  });

  it("uses 429 only for transient persistence or fresh correlation races", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "UNMATCHED", error: null });
    const race = await POST(request());
    expect(race.status).toBe(429);
    expect(race.headers.get("retry-after")).toBe("600");

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "temporary" } });
    const persistence = await POST(request());
    expect(persistence.status).toBe(429);
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Brevo webhook evidence persistence unavailable",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("safely acknowledges unsupported and stale unmatched callbacks", async () => {
    expect((await POST(request({ ...basePayload, event: "opened" }))).status).toBe(204);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValueOnce({ data: "UNMATCHED", error: null });
    const stale = await POST(
      request({ ...basePayload, ts_event: Math.floor(Date.now() / 1000) - 3_600 }),
    );
    expect(stale.status).toBe(204);
  });

  it("rejects malformed JSON, wrong media type, malformed projection and oversized bodies", async () => {
    expect((await POST(request("{", {}))).status).toBe(400);
    expect(
      (await POST(request(basePayload, { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await POST(request({ ...basePayload, ts_event: "not-an-epoch" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ ...basePayload, ts_event: Math.floor(Date.now() / 1000) + 301 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request("x", {
            "content-length": String(32 * 1024 + 1),
          }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts the JSON media type case-insensitively", async () => {
    expect(
      (await POST(request(basePayload, { "content-type": "Application/JSON" }))).status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
