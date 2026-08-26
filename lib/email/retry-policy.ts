import type { TransactionalEmailProviderName } from "@/lib/email/types";

export type EmailRetryClassification = "RETRYABLE" | "AMBIGUOUS" | "NON_RETRYABLE";

export type EmailRetryEligibility = {
  eligible: boolean;
  classification: EmailRetryClassification;
  code:
    | "SAFE_TRANSIENT_FAILURE"
    | "DELIVERY_OUTCOME_UNCERTAIN"
    | "EVENT_NOT_FAILED"
    | "EVENT_ALREADY_ACCEPTED"
    | "EVENT_IN_PROGRESS"
    | "ATTEMPT_HISTORY_UNAVAILABLE"
    | "ATTEMPT_EVIDENCE_MISMATCH"
    | "PROVIDER_HISTORY_UNAVAILABLE"
    | "PROVIDER_CONFIGURATION_UNAVAILABLE"
    | "PERMANENT_PROVIDER_FAILURE"
    | "INVALID_MESSAGE_DATA"
    | "MESSAGE_RECONSTRUCTION_UNAVAILABLE"
    | "UNKNOWN_FAILURE";
  explanation: string;
};

export type EmailRetryAttemptEvidence = {
  attemptNumber: number;
  provider: string;
  status: "SENDING" | "SENT" | "FAILED";
  failureCode: string | null;
};

export type EmailRetryPolicyInput = {
  status: "PENDING" | "SENDING" | "SENT" | "FAILED";
  eventType:
    | "BOOKING_CONFIRMED"
    | "BOOKING_CANCELLED"
    | "BOOKING_AMENDMENT_REQUESTED"
    | "BOOKING_AMENDMENT_CONFIRMED"
    | "BOOKING_ADDON_REQUESTED"
    | "BOOKING_ADDON_CONFIRMED"
    | "BOOKING_RESCHEDULED"
    | "BOOKING_DELIVERED";
  attemptCount: number;
  failureCode: string | null;
  latestAttempt: EmailRetryAttemptEvidence | null;
  isProviderConfigured: (provider: TransactionalEmailProviderName) => boolean;
};

const retryableHttpFailure = /^provider_http_5\d\d$/;
const permanentHttpFailure = /^provider_http_4\d\d$/;

export function buildEmailAttemptIdempotencyKey(
  logicalEventKey: string,
  attemptNumber: number,
) {
  return `${logicalEventKey}/attempt/${attemptNumber}`;
}

function decision(
  eligible: boolean,
  classification: EmailRetryClassification,
  code: EmailRetryEligibility["code"],
  explanation: string,
): EmailRetryEligibility {
  return { eligible, classification, code, explanation };
}

export function getEmailRetryEligibility({
  status,
  eventType,
  attemptCount,
  failureCode,
  latestAttempt,
  isProviderConfigured,
}: EmailRetryPolicyInput): EmailRetryEligibility {
  if (status === "SENT") {
    return decision(
      false,
      "NON_RETRYABLE",
      "EVENT_ALREADY_ACCEPTED",
      "Retry unavailable because the provider already accepted this event.",
    );
  }

  if (status === "PENDING" || status === "SENDING") {
    return decision(
      false,
      "NON_RETRYABLE",
      "EVENT_IN_PROGRESS",
      "Retry unavailable while the existing delivery workflow is pending or sending.",
    );
  }

  if (status !== "FAILED") {
    return decision(
      false,
      "NON_RETRYABLE",
      "EVENT_NOT_FAILED",
      "Retry is available only for a safely classified failed event.",
    );
  }

  if (
    eventType === "BOOKING_AMENDMENT_REQUESTED" ||
    eventType === "BOOKING_ADDON_REQUESTED" ||
    eventType === "BOOKING_RESCHEDULED"
  ) {
    return decision(
      false,
      "NON_RETRYABLE",
      "MESSAGE_RECONSTRUCTION_UNAVAILABLE",
      "Retry unavailable because the original secure customer link cannot be reconstructed from stored outbox evidence.",
    );
  }

  if (!latestAttempt) {
    return decision(
      false,
      "NON_RETRYABLE",
      "ATTEMPT_HISTORY_UNAVAILABLE",
      "Retry unavailable because provider-pinned attempt evidence is unavailable.",
    );
  }

  if (
    latestAttempt.attemptNumber !== attemptCount ||
    latestAttempt.status !== "FAILED" ||
    latestAttempt.failureCode !== failureCode
  ) {
    return decision(
      false,
      "AMBIGUOUS",
      "ATTEMPT_EVIDENCE_MISMATCH",
      "Retry unavailable because the current event and attempt evidence do not agree.",
    );
  }

  if (
    !(["development", "brevo", "resend"] as const).includes(
      latestAttempt.provider as TransactionalEmailProviderName,
    )
  ) {
    return decision(
      false,
      "NON_RETRYABLE",
      "PROVIDER_HISTORY_UNAVAILABLE",
      "Retry unavailable because the original delivery provider is not known.",
    );
  }

  const provider = latestAttempt.provider as TransactionalEmailProviderName;
  if (!isProviderConfigured(provider)) {
    return decision(
      false,
      "NON_RETRYABLE",
      "PROVIDER_CONFIGURATION_UNAVAILABLE",
      "Retry unavailable until the original provider configuration is available.",
    );
  }

  if (
    failureCode === "provider_http_429" ||
    failureCode === "provider_connect_failure" ||
    (failureCode !== null && retryableHttpFailure.test(failureCode))
  ) {
    return decision(
      true,
      "RETRYABLE",
      "SAFE_TRANSIENT_FAILURE",
      "The provider did not accept the prior attempt and the transient failure is safe to retry.",
    );
  }

  if (
    failureCode === "provider_timeout" ||
    failureCode === "provider_network_failure" ||
    failureCode === "provider_invalid_response" ||
    failureCode === "provider_exception" ||
    failureCode === "delivery_state_update_failed"
  ) {
    return decision(
      false,
      "AMBIGUOUS",
      "DELIVERY_OUTCOME_UNCERTAIN",
      "Retry unavailable because the provider may already have accepted the prior attempt.",
    );
  }

  if (
    failureCode === "provider_not_configured" ||
    failureCode === "invalid_sender" ||
    failureCode === "invalid_recipient" ||
    (failureCode !== null && permanentHttpFailure.test(failureCode))
  ) {
    return decision(
      false,
      "NON_RETRYABLE",
      "PERMANENT_PROVIDER_FAILURE",
      "Retry unavailable because the recipient, sender, request, or provider configuration must be corrected first.",
    );
  }

  if (
    failureCode?.startsWith("invalid_") ||
    failureCode?.endsWith("_url_unavailable") ||
    failureCode?.endsWith("_url_invalid")
  ) {
    return decision(
      false,
      "NON_RETRYABLE",
      "INVALID_MESSAGE_DATA",
      "Retry unavailable because the event cannot currently produce a valid transactional message.",
    );
  }

  return decision(
    false,
    "AMBIGUOUS",
    "UNKNOWN_FAILURE",
    "Retry unavailable because the prior delivery outcome cannot be established safely.",
  );
}
