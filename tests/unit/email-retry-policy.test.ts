import { describe, expect, it } from "vitest";
import {
  buildEmailAttemptIdempotencyKey,
  getEmailRetryEligibility,
  type EmailRetryPolicyInput,
} from "@/lib/email/retry-policy";

const base: EmailRetryPolicyInput = {
  status: "FAILED",
  eventType: "BOOKING_CONFIRMED",
  attemptCount: 1,
  failureCode: "provider_http_429",
  latestAttempt: {
    attemptNumber: 1,
    provider: "brevo",
    status: "FAILED",
    failureCode: "provider_http_429",
  },
  isProviderConfigured: () => true,
};

function evaluate(overrides: Partial<EmailRetryPolicyInput>) {
  const input = { ...base, ...overrides };
  if (overrides.failureCode !== undefined && overrides.latestAttempt === undefined) {
    input.latestAttempt = {
      ...base.latestAttempt!,
      failureCode: overrides.failureCode,
    };
  }
  return getEmailRetryEligibility(input);
}

describe("failed transactional email retry policy", () => {
  it("uses one stable provider key per attempt and a new key for a legitimate retry", () => {
    expect(buildEmailAttemptIdempotencyKey("email-event/abc", 1)).toBe(
      "email-event/abc/attempt/1",
    );
    expect(buildEmailAttemptIdempotencyKey("email-event/abc", 2)).toBe(
      "email-event/abc/attempt/2",
    );
  });
  it.each([
    ["provider_http_429", "rate limit"],
    ["provider_http_500", "provider 500"],
    ["provider_http_503", "provider 503"],
    ["provider_connect_failure", "proven pre-submission connect failure"],
  ])("allows %s as a safe retryable failure (%s)", (failureCode) => {
    expect(evaluate({ failureCode })).toMatchObject({
      eligible: true,
      classification: "RETRYABLE",
      code: "SAFE_TRANSIENT_FAILURE",
    });
  });

  it.each([
    ["provider_timeout", "timeout after submission"],
    ["provider_network_failure", "unproven network stage"],
    ["provider_invalid_response", "malformed success response"],
    ["provider_exception", "unknown provider exception"],
    ["delivery_state_update_failed", "acceptance persistence failure"],
    ["unrecognized_failure", "unknown failure"],
  ])("blocks %s as ambiguous (%s)", (failureCode) => {
    expect(evaluate({ failureCode })).toMatchObject({
      eligible: false,
      classification: "AMBIGUOUS",
    });
  });

  it.each([
    ["provider_http_401", "provider authentication"],
    ["provider_http_403", "provider authorization"],
    ["provider_http_400", "permanent provider rejection"],
    ["invalid_recipient", "invalid recipient"],
    ["invalid_sender", "invalid sender"],
    ["provider_not_configured", "provider configuration"],
    ["invalid_confirmation_snapshot", "invalid message data"],
    ["delivery_event_retry_horizon_elapsed", "delivery horizon elapsed"],
    ["delivery_feedback_capability_expired", "feedback capability expired"],
  ])("blocks %s as non-retryable (%s)", (failureCode) => {
    expect(evaluate({ failureCode })).toMatchObject({
      eligible: false,
      classification: "NON_RETRYABLE",
    });
  });

  it.each([
    ["SENT", "EVENT_ALREADY_ACCEPTED"],
    ["PENDING", "EVENT_IN_PROGRESS"],
    ["SENDING", "EVENT_IN_PROGRESS"],
  ] as const)("denies a %s event", (status, code) => {
    expect(evaluate({ status })).toMatchObject({ eligible: false, code });
  });

  it("requires aligned provider-pinned attempt evidence", () => {
    expect(evaluate({ latestAttempt: null })).toMatchObject({
      eligible: false,
      code: "ATTEMPT_HISTORY_UNAVAILABLE",
    });
    expect(
      evaluate({
        latestAttempt: { ...base.latestAttempt!, attemptNumber: 2 },
      }),
    ).toMatchObject({ eligible: false, classification: "AMBIGUOUS" });
    expect(
      evaluate({
        latestAttempt: { ...base.latestAttempt!, provider: "unknown" },
      }),
    ).toMatchObject({ eligible: false, code: "PROVIDER_HISTORY_UNAVAILABLE" });
  });

  it("blocks retries while the original provider is unavailable", () => {
    expect(evaluate({ isProviderConfigured: () => false })).toMatchObject({
      eligible: false,
      code: "PROVIDER_CONFIGURATION_UNAVAILABLE",
    });
  });

  it.each([
    "BOOKING_AMENDMENT_REQUESTED",
    "BOOKING_ADDON_REQUESTED",
    "BOOKING_RESCHEDULED",
  ] as const)(
    "blocks %s because its original capability URL is not recoverable",
    (eventType) => {
      expect(evaluate({ eventType })).toMatchObject({
        eligible: false,
        code: "MESSAGE_RECONSTRUCTION_UNAVAILABLE",
      });
    },
  );
});
