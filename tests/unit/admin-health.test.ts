import { describe, expect, it } from "vitest";
import {
  buildAdminHealthView,
  getSecurityActivityLabel,
  parseAdminHealthSummary,
  parseAdminSecurityActivity,
  type AdminHealthSummary,
  type AdminRuntimeConfiguration,
} from "@/features/admin/health";
import type { AdminMfaSecurityStatus } from "@/features/admin/security";

const checkedAt = "2026-08-26T20:40:00+00:00";

function validSummary(): AdminHealthSummary {
  return {
    checked_at: checkedAt,
    stale_email_threshold_minutes: 15,
    database: { minimal_read_succeeded: true },
    email: {
      pending: 0,
      sending: 0,
      accepted_24h: 4,
      failed: 0,
      failed_24h: 0,
      failed_attempts_24h: 0,
      stale_pending: 0,
      stale_sending: 0,
      oldest_pending_at: null,
      oldest_sending_at: null,
    },
    issues: { open: 0, created_24h: 0, oldest_open_at: null },
    bookings: { overdue: 0 },
    admins: { active: 2, disabled: 0 },
  };
}

function validConfiguration(): AdminRuntimeConfiguration {
  return {
    environment: "PRODUCTION",
    canonicalDomain: "mykustomers.com",
    canonicalDomainConfigured: true,
    deploymentCommit: "abc1234",
    supabasePublicConfigured: true,
    supabaseServiceConfigured: true,
    primaryEmailProvider: { name: "brevo", label: "Brevo", configured: true },
    standbyEmailProvider: { name: "resend", label: "Resend", configured: true },
  };
}

function validMfa(): AdminMfaSecurityStatus {
  return {
    currentLevel: "aal1",
    nextLevel: "aal2",
    verifiedFactors: [
      {
        id: "9a221c16-f98e-4284-841b-1b4c57abc7b8",
        friendlyName: "Authenticator app",
        createdAt: checkedAt,
      },
    ],
    unverifiedFactorCount: 0,
    privilegedAccessReady: false,
  };
}

describe("admin Security & Health DTO", () => {
  it("strictly parses the minimized health summary", () => {
    const summary = validSummary();
    expect(parseAdminHealthSummary(summary)).toEqual(summary);
    expect(
      parseAdminHealthSummary({
        ...summary,
        email: { ...summary.email, recipient_email: "private@example.com" },
      }),
    ).toBeNull();
    expect(parseAdminHealthSummary({ ...summary, customer_phone: "+234000" })).toBeNull();
    expect(
      parseAdminHealthSummary({ ...summary, stale_email_threshold_minutes: 16 }),
    ).toBeNull();
  });

  it("strictly parses only bounded allowlisted security activity", () => {
    const activity = {
      items: [
        {
          id: "d0557694-0a4e-4bf8-935a-7d9bb943fd40",
          event_type: "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
          actor: {
            display_name: "Platform operator",
            email: "operator@example.com",
            source: "PLATFORM_ADMIN",
          },
          target: {
            type: "EMAIL_EVENT",
            reference: "ec8da2d6-60ee-4434-b3b6-a19d79e7e470",
          },
          reason: "Retry after a temporary provider failure; safe & reviewed.",
          result: "REQUESTED",
          created_at: checkedAt,
        },
      ],
    };

    expect(parseAdminSecurityActivity(activity)).toEqual(activity);
    expect(
      parseAdminSecurityActivity({
        items: [{ ...activity.items[0], raw_provider_error: "secret payload" }],
      }),
    ).toBeNull();
    expect(
      parseAdminSecurityActivity({
        items: [{ ...activity.items[0], event_type: "CUSTOMER_UPDATED" }],
      }),
    ).toBeNull();
    expect(
      parseAdminSecurityActivity({
        items: Array.from({ length: 21 }, (_, index) => ({
          ...activity.items[0],
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      }),
    ).toBeNull();
  });
});

describe("admin health aggregation", () => {
  it("is operational only when core evidence and account resilience are normal", () => {
    const view = buildAdminHealthView({
      summary: validSummary(),
      mfa: validMfa(),
      configuration: validConfiguration(),
      securityActivityAvailable: true,
    });

    expect(view.overall).toBe("OPERATIONAL");
    expect(view.attentionItems).toEqual([]);
    expect(view.services.map((service) => service.state)).toEqual([
      "OPERATIONAL",
      "OPERATIONAL",
      "OPERATIONAL",
      "OPERATIONAL",
    ]);
    expect(view.securityStatement).toContain("No current critical");
  });

  it("treats outbox and operational anomalies as attention, not service failure", () => {
    const summary = validSummary();
    summary.email.failed = 3;
    summary.email.failed_24h = 2;
    summary.email.stale_pending = 1;
    summary.email.pending = 1;
    summary.issues.open = 2;
    summary.bookings.overdue = 4;
    summary.admins.active = 1;

    const view = buildAdminHealthView({
      summary,
      mfa: validMfa(),
      configuration: validConfiguration(),
      securityActivityAvailable: true,
    });

    expect(view.overall).toBe("ATTENTION");
    expect(
      view.services.find((service) => service.label === "Transactional email")?.state,
    ).toBe("ATTENTION");
    expect(
      view.attentionItems.filter((item) => item.id === "failed-emails"),
    ).toHaveLength(1);
    expect(view.attentionItems.map((item) => item.id)).toEqual([
      "failed-emails",
      "stale-emails",
      "open-issues",
      "admin-resilience",
      "overdue-bookings",
    ]);
  });

  it("degrades for a failed database read or missing required production config", () => {
    const missingConfig = validConfiguration();
    missingConfig.supabaseServiceConfigured = false;
    missingConfig.primaryEmailProvider.configured = false;

    const view = buildAdminHealthView({
      summary: null,
      mfa: validMfa(),
      configuration: missingConfig,
      securityActivityAvailable: false,
    });

    expect(view.overall).toBe("DEGRADED");
    expect(view.services.find((service) => service.label === "Database")?.state).toBe(
      "DEGRADED",
    );
    expect(
      view.services.find((service) => service.label === "Transactional email")?.state,
    ).toBe("DEGRADED");
    expect(view.attentionItems[0].severity).toBe("CRITICAL");
    expect(view.attentionItems.map((item) => item.id)).toContain("security-activity");
  });

  it("reports unknown rather than green when security activity cannot be checked", () => {
    const view = buildAdminHealthView({
      summary: validSummary(),
      mfa: validMfa(),
      configuration: validConfiguration(),
      securityActivityAvailable: false,
    });

    expect(view.overall).toBe("UNKNOWN");
    expect(view.attentionItems.map((item) => item.id)).toContain("security-activity");
  });

  it("represents missing MFA evidence as attention rather than a security claim", () => {
    const view = buildAdminHealthView({
      summary: validSummary(),
      mfa: null,
      configuration: validConfiguration(),
      securityActivityAvailable: true,
    });

    expect(view.overall).toBe("ATTENTION");
    expect(view.attentionItems.find((item) => item.id === "mfa")?.title).toContain(
      "unavailable",
    );
    expect(view.securityStatement).toContain("requires attention");
  });

  it("maps every persisted activity event to human-facing copy", () => {
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_CREATED")).toBe(
      "Platform administrator created",
    );
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_UPDATED")).toBe(
      "Platform administrator updated",
    );
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_DISABLED")).toBe(
      "Platform administrator disabled",
    );
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED")).toBe(
      "Failed-email retry requested",
    );
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED")).toContain(
      "accepted by provider",
    );
    expect(getSecurityActivityLabel("PLATFORM_ADMIN_EMAIL_RETRY_FAILED")).toBe(
      "Failed-email retry failed",
    );
  });
});
