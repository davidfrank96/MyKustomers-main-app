import { describe, expect, it } from "vitest";
import { confirmationDispatchFeedback } from "@/features/confirmation-links/dispatch-feedback";

describe("confirmation dispatch presentation", () => {
  it.each([
    "provider_not_configured",
    "provider_connect_failure",
    "invalid_recipient",
    "invalid_confirmation_request_event",
    "provider_http_400",
    "provider_http_503",
  ])("reports proven non-acceptance for %s", (code) => {
    expect(confirmationDispatchFeedback({ status: "failed", code }).deliveryStatus).toBe(
      "failed",
    );
  });
  it("distinguishes rate limits and unprocessed requests", () => {
    expect(
      confirmationDispatchFeedback({ status: "failed", code: "provider_http_429" })
        .deliveryStatus,
    ).toBe("rate_limited");
    expect(
      confirmationDispatchFeedback({
        status: "skipped",
        reason: "service-role-unavailable",
      }).deliveryStatus,
    ).toBe("queued");
    expect(
      confirmationDispatchFeedback({ status: "skipped", reason: "not-claimable" })
        .deliveryStatus,
    ).toBe("ambiguous");
    expect(
      confirmationDispatchFeedback({ status: "failed", code: "provider_http_408" })
        .deliveryStatus,
    ).toBe("ambiguous");
  });
});
