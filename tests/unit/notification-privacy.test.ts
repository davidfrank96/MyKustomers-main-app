import { describe, expect, it } from "vitest";
import { beforeSentrySend, sanitizeSentryUrl } from "@/lib/observability/sentry";
describe("notification telemetry privacy", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/opaque-subscription",
    "https://web.push.apple.com/opaque-subscription",
    "https://updates.push.services.mozilla.com/wpush/v2/opaque-subscription",
  ])("redacts provider endpoint paths: %s", (url) => {
    expect(sanitizeSentryUrl(url)).not.toContain("opaque-subscription");
    expect(sanitizeSentryUrl(url)).toContain("[redacted-push-endpoint]");
  });
  it("drops encryption keys, device endpoint data and worker credentials", () => {
    const value = beforeSentrySend({
      type: undefined,
      message: "Notification worker unavailable",
      extra: {
        endpoint: "opaque-endpoint",
        p256dh: "opaque-public-key",
        auth_key: "opaque-auth-key",
        vapid_private_key: "opaque-private-key",
        authorization: "Bearer opaque-worker-secret",
      },
    });
    expect(JSON.stringify(value)).not.toMatch(/opaque-/);
  });
});
