// @vitest-environment node
import { createECDH, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import webPush from "web-push";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
import { sendNotificationDelivery } from "@/features/notifications/worker";
const vapid = {
  ...webPush.generateVAPIDKeys(),
  subject: "mailto:fixture@example.invalid",
};
const ecdh = createECDH("prime256v1");
const delivery = {
  delivery_id: "11111111-1111-4111-8111-111111111111",
  lease_token: "22222222-2222-4222-8222-222222222222",
  notification_id: "33333333-3333-4333-8333-333333333333",
  notification_type: "CUSTOMER_CONFIRMED",
  business_id: "44444444-4444-4444-8444-444444444444",
  booking_id: "55555555-5555-4555-8555-555555555555",
  endpoint: "https://fcm.googleapis.com/local-transport-fixture",
  p256dh: ecdh.generateKeys().toString("base64url"),
  auth_key: randomBytes(16).toString("base64url"),
  unread_count: 3,
};
afterEach(() => vi.unstubAllGlobals());
describe("standard encrypted Web Push handoff", () => {
  it("uses audited encryption, a bounded TTL, total timeout and no redirects", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendNotificationDelivery(delivery, vapid)).toEqual({
      status: 201,
      retryAfter: null,
    });
    const [endpoint, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(delivery.endpoint);
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers).toMatchObject({
      TTL: 86400,
      "Content-Encoding": "aes128gcm",
    });
    expect(Buffer.from(options.body as Uint8Array).toString()).not.toMatch(
      /CUSTOMER_CONFIRMED|business_id|booking_id/,
    );
    expect(JSON.stringify(options.headers)).not.toContain(vapid.privateKey);
  });
  it.each([404, 410, 429, 503])(
    "returns only status and bounded retry metadata for %i",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response("private provider body", {
              status,
              headers: { "Retry-After": "180" },
            }),
        ),
      );
      expect(await sendNotificationDelivery(delivery, vapid)).toEqual({
        status,
        retryAfter: 180,
      });
    },
  );
  it("does not retry or expose a timeout/SDK error that contains device secrets", async () => {
    const fetch = vi.fn(async () => {
      throw new Error(`private ${delivery.endpoint} ${delivery.auth_key}`);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await sendNotificationDelivery(delivery, vapid)).toEqual({
      status: null,
      retryAfter: null,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects an unsafe queue endpoint without a network call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      await sendNotificationDelivery(
        { ...delivery, endpoint: "https://127.0.0.1/private" },
        vapid,
      ),
    ).toEqual({ status: 400, retryAfter: null });
    expect(fetch).not.toHaveBeenCalled();
  });
});
