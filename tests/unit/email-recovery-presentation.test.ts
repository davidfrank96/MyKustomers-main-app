import { describe, expect, it } from "vitest";
import {
  getEmailRecoveryPresentation,
  providerDeliveryStatuses,
  type ProviderDeliveryStatus,
  type ProviderDeliverySummary,
} from "@/features/provider-delivery/model";

function delivery(
  status: ProviderDeliveryStatus,
  overrides: Partial<ProviderDeliverySummary> = {},
): ProviderDeliverySummary {
  return {
    outbox_status: "SENT",
    development_adapter: false,
    provider_delivery_status: status,
    provider_event_at: status === "UNKNOWN" ? null : "2026-09-05T10:00:00.000Z",
    reason_category: status === "UNKNOWN" ? null : "NONE",
    evidence_received_at: status === "UNKNOWN" ? null : "2026-09-05T10:00:01.000Z",
    ...overrides,
  };
}

describe("vendor email recovery presentation", () => {
  it.each([
    ["UNKNOWN", "Email accepted for delivery", "neutral", "share_confirmation", false],
    ["DELIVERED", "Provider reported delivery", "positive", "share_confirmation", false],
    ["DEFERRED", "Delivery delayed", "warning", "share_whatsapp", false],
    [
      "SOFT_BOUNCED",
      "Email could not be delivered after temporary attempts",
      "warning",
      "check_email",
      false,
    ],
    ["HARD_BOUNCED", "Email could not be delivered", "critical", "edit_email", false],
    ["INVALID", "Email could not be delivered", "critical", "edit_email", false],
    [
      "BLOCKED",
      "Email sending is unavailable for this address",
      "critical",
      "use_another_contact_method",
      false,
    ],
    [
      "COMPLAINT",
      "Email sending has been stopped for this address",
      "critical",
      "use_another_contact_method",
      false,
    ],
    [
      "PROVIDER_ERROR",
      "Provider reported a delivery error",
      "warning",
      "share_confirmation",
      false,
    ],
  ] as const)(
    "maps %s to human recovery policy",
    (status, title, tone, primaryAction, allowUnchangedEmailSend) => {
      expect(
        getEmailRecoveryPresentation({
          summary: delivery(status),
          confirmed: false,
          hasCustomerEmail: true,
        }),
      ).toMatchObject({
        title,
        tone,
        primaryAction,
        allowUnchangedEmailSend,
        ariaLabel: expect.stringContaining(title),
      });
    },
  );

  it("distinguishes queued, sending, accepted, failed acceptance, and development operations", () => {
    expect(
      getEmailRecoveryPresentation({
        summary: delivery("UNKNOWN", { outbox_status: "PENDING" }),
        confirmed: false,
        hasCustomerEmail: true,
      }).title,
    ).toBe("Confirmation email queued");
    expect(
      getEmailRecoveryPresentation({
        summary: delivery("UNKNOWN", { outbox_status: "SENDING" }),
        confirmed: false,
        hasCustomerEmail: true,
      }).title,
    ).toBe("Confirmation email is being sent");
    expect(
      getEmailRecoveryPresentation({
        summary: delivery("UNKNOWN", { outbox_status: "SENT" }),
        confirmed: false,
        hasCustomerEmail: true,
      }).description,
    ).toContain("not yet received a delivery update");
    expect(
      getEmailRecoveryPresentation({
        summary: delivery("UNKNOWN", { outbox_status: "FAILED" }),
        confirmed: false,
        hasCustomerEmail: true,
      }),
    ).toMatchObject({
      title: "Email acceptance could not be confirmed",
      primaryAction: "check_email",
      allowUnchangedEmailSend: true,
    });
    expect(
      getEmailRecoveryPresentation({
        summary: delivery("UNKNOWN", {
          outbox_status: "SENT",
          development_adapter: true,
        }),
        confirmed: false,
        hasCustomerEmail: true,
      }).title,
    ).toBe("Development adapter — no external email sent");
  });

  it.each(providerDeliveryStatuses)(
    "lets customer confirmation supersede %s transport state",
    (status) => {
      expect(
        getEmailRecoveryPresentation({
          summary: delivery(status),
          confirmed: true,
          hasCustomerEmail: true,
        }),
      ).toMatchObject({
        title: "Customer confirmed",
        tone: "positive",
        primaryAction: null,
        allowUnchangedEmailSend: false,
      });
    },
  );

  it("keeps no-email recovery explicit without fabricating a recipient", () => {
    expect(
      getEmailRecoveryPresentation({
        summary: null,
        confirmed: false,
        hasCustomerEmail: false,
      }),
    ).toMatchObject({
      title: "No customer email added",
      primaryAction: "add_email",
      secondaryActions: ["share_confirmation"],
    });
  });
});
