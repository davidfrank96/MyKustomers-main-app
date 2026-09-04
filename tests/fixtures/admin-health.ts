import type { ComponentProps } from "react";
import type { AdminSecurityHealth } from "@/components/admin/admin-security-health";

type Props = ComponentProps<typeof AdminSecurityHealth>;
export const securityStates = [
  "attention",
  "healthy",
  "configured",
  "activity",
  "unavailable",
  "loading",
  "refreshing",
  "stress",
] as const;
export type SecurityState = (typeof securityStates)[number];

export function securityFixture(state: SecurityState = "attention"): Props {
  const props: Props = {
    admin: {
      userId: "00000000-0000-4000-8000-000000000001",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    summary: {
      checked_at: "2026-09-04T00:10:00.000Z",
      stale_email_threshold_minutes: 15,
      database: { minimal_read_succeeded: true },
      email: {
        pending: 1,
        sending: 0,
        accepted_24h: 12,
        failed: 0,
        failed_24h: 0,
        failed_attempts_24h: 0,
        stale_pending: 1,
        stale_sending: 0,
        oldest_pending_at: null,
        oldest_sending_at: null,
      },
      issues: { open: 0, created_24h: 0, oldest_open_at: null },
      bookings: { overdue: 17 },
      admins: { active: 1, disabled: 0 },
    },
    activity: {
      items: Array.from({ length: 5 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
        event_type: index === 0 ? "PLATFORM_ADMIN_UPDATED" : "PLATFORM_ADMIN_CREATED",
        actor: {
          display_name: null,
          email: null,
          source: "CONTROLLED_DATABASE_OPERATOR",
        },
        target: { type: "PLATFORM_ADMIN", reference: null },
        reason: null,
        result: "RECORDED",
        created_at: `2026-09-03T22:0${9 - index}:00.000Z`,
      })),
    },
    mfa: {
      currentLevel: "aal1",
      nextLevel: "aal1",
      verifiedFactors: [],
      unverifiedFactorCount: 0,
      privilegedAccessReady: false,
    },
    configuration: {
      environment: "LOCAL",
      canonicalDomain: "review.example.test",
      canonicalDomainConfigured: true,
      deploymentCommit: "abcdef123456",
      supabasePublicConfigured: true,
      supabaseServiceConfigured: true,
      primaryEmailProvider: {
        name: "development",
        label: "Development",
        configured: true,
      },
      standbyEmailProvider: { name: "resend", label: "Resend", configured: false },
    },
  };
  if (state === "healthy" || state === "configured") {
    props.summary!.email.stale_pending = 0;
    props.summary!.bookings.overdue = 0;
    props.summary!.admins.active = 2;
    props.mfa = {
      currentLevel: state === "healthy" ? "aal2" : "aal1",
      nextLevel: "aal2",
      verifiedFactors: [
        {
          id: "00000000-0000-4000-8000-000000000020",
          friendlyName: "Review authenticator",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      unverifiedFactorCount: 0,
      privilegedAccessReady: state === "healthy",
    };
  }
  if (state === "activity" || state === "stress") {
    props.activity!.items = Array.from({ length: 12 }, (_, index) => ({
      ...props.activity!.items[0],
      id: `00000000-0000-4000-8000-${String(index + 30).padStart(12, "0")}`,
      created_at: new Date(Date.UTC(2026, 8, 3, 23, 59 - index)).toISOString(),
      event_type: "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
      actor: {
        display_name:
          "Controlled review administrator with a long descriptive display name",
        email: null,
        source: "PLATFORM_ADMIN",
      },
      reason:
        "A synthetic operational review reason included to verify wrapping and preserve every loaded activity record.",
    }));
  }
  if (state === "unavailable") {
    props.summary = null;
    props.activity = null;
    props.mfa = null;
  }
  if (state === "stress") {
    props.configuration.canonicalDomain =
      "long-review-subdomain.".repeat(8) + "example.test";
    props.configuration.deploymentCommit = "abcdef1234567890".repeat(6);
    props.configuration.primaryEmailProvider.label =
      "A deliberately long synthetic provider configuration label";
    props.configuration.primaryEmailProvider.configured = false;
    props.configuration.canonicalDomainConfigured = false;
    props.configuration.supabasePublicConfigured = false;
    props.summary!.email.failed = 12500;
    props.summary!.email.accepted_24h = Number.MAX_SAFE_INTEGER;
    props.summary!.issues.open = 250;
  }
  return props;
}
