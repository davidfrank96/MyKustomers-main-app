import { z } from "zod";
import type { AdminMfaSecurityStatus } from "@/features/admin/security";
import { adminCountSchema } from "@/features/admin/overview";

export const ADMIN_HEALTH_STATES = [
  "OPERATIONAL",
  "ATTENTION",
  "DEGRADED",
  "UNKNOWN",
] as const;

export type AdminHealthState = (typeof ADMIN_HEALTH_STATES)[number];

const timestampSchema = z.string().datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();

const adminHealthSummarySchema = z
  .object({
    checked_at: timestampSchema,
    stale_email_threshold_minutes: z.literal(15),
    database: z
      .object({
        minimal_read_succeeded: z.literal(true),
      })
      .strict(),
    email: z
      .object({
        pending: adminCountSchema,
        sending: adminCountSchema,
        accepted_24h: adminCountSchema,
        failed: adminCountSchema,
        failed_24h: adminCountSchema,
        failed_attempts_24h: adminCountSchema,
        stale_pending: adminCountSchema,
        stale_sending: adminCountSchema,
        oldest_pending_at: nullableTimestampSchema,
        oldest_sending_at: nullableTimestampSchema,
      })
      .strict(),
    issues: z
      .object({
        open: adminCountSchema,
        created_24h: adminCountSchema,
        oldest_open_at: nullableTimestampSchema,
      })
      .strict(),
    bookings: z
      .object({
        overdue: adminCountSchema,
      })
      .strict(),
    admins: z
      .object({
        active: adminCountSchema,
        disabled: adminCountSchema,
      })
      .strict(),
  })
  .strict();

const securityEventTypeSchema = z.enum([
  "PLATFORM_ADMIN_CREATED",
  "PLATFORM_ADMIN_UPDATED",
  "PLATFORM_ADMIN_DISABLED",
  "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
  "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
  "PLATFORM_ADMIN_EMAIL_RETRY_FAILED",
]);

const adminSecurityActivitySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            event_type: securityEventTypeSchema,
            actor: z
              .object({
                display_name: z.string().trim().min(1).max(120).nullable(),
                email: z.string().email().max(254).nullable(),
                source: z.enum([
                  "PLATFORM_ADMIN",
                  "CONTROLLED_DATABASE_OPERATOR",
                  "UNKNOWN_AUTHENTICATED_ACTOR",
                ]),
              })
              .strict(),
            target: z
              .object({
                type: z.enum(["PLATFORM_ADMIN", "EMAIL_EVENT"]),
                reference: z.string().uuid().nullable(),
              })
              .strict(),
            reason: z.string().trim().min(1).max(500).nullable(),
            result: z.enum(["RECORDED", "REQUESTED", "PROVIDER_ACCEPTED", "FAILED"]),
            created_at: timestampSchema,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type AdminHealthSummary = z.infer<typeof adminHealthSummarySchema>;
export type AdminSecurityActivity = z.infer<typeof adminSecurityActivitySchema>;
export type AdminSecurityActivityItem = AdminSecurityActivity["items"][number];

export function parseAdminHealthSummary(value: unknown): AdminHealthSummary | null {
  const result = adminHealthSummarySchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAdminSecurityActivity(value: unknown): AdminSecurityActivity | null {
  const result = adminSecurityActivitySchema.safeParse(value);
  return result.success ? result.data : null;
}

export type AdminRuntimeConfiguration = {
  environment: "PRODUCTION" | "PREVIEW" | "DEVELOPMENT" | "LOCAL" | "UNKNOWN";
  canonicalDomain: string;
  canonicalDomainConfigured: boolean;
  deploymentCommit: string | null;
  supabasePublicConfigured: boolean;
  supabaseServiceConfigured: boolean;
  primaryEmailProvider: {
    name: string;
    label: string;
    configured: boolean;
  };
  standbyEmailProvider: {
    name: "resend";
    label: "Resend";
    configured: boolean;
  };
};

export type AdminHealthService = {
  label: string;
  state: AdminHealthState;
  description: string;
  evidence: string;
};

export type AdminHealthAttentionItem = {
  id: string;
  severity: "INFORMATIONAL" | "ATTENTION" | "CRITICAL";
  title: string;
  description: string;
  href?: "/admin/bookings?filter=overdue" | "/admin/emails" | "/admin/issues?status=OPEN";
};

export type AdminHealthView = {
  overall: AdminHealthState;
  services: AdminHealthService[];
  attentionItems: AdminHealthAttentionItem[];
  securityStatement: string;
};

type BuildAdminHealthViewInput = {
  summary: AdminHealthSummary | null;
  mfa: AdminMfaSecurityStatus | null;
  configuration: AdminRuntimeConfiguration;
  securityActivityAvailable: boolean;
};

function buildServices({
  summary,
  configuration,
}: Pick<BuildAdminHealthViewInput, "summary" | "configuration">): AdminHealthService[] {
  const applicationConfigured =
    configuration.supabasePublicConfigured &&
    configuration.supabaseServiceConfigured &&
    configuration.canonicalDomainConfigured;
  const emailConfigured =
    configuration.primaryEmailProvider.configured &&
    (configuration.environment !== "PRODUCTION" ||
      configuration.primaryEmailProvider.name === "brevo");
  const staleEmails = summary
    ? summary.email.stale_pending + summary.email.stale_sending
    : 0;

  return [
    {
      label: "Application",
      state: applicationConfigured ? "OPERATIONAL" : "DEGRADED",
      description: applicationConfigured
        ? "Required application configuration is present."
        : "Required application configuration is incomplete.",
      evidence: `${configuration.environment.toLowerCase()} runtime · ${configuration.canonicalDomain}`,
    },
    {
      label: "Database",
      state: summary?.database.minimal_read_succeeded ? "OPERATIONAL" : "DEGRADED",
      description: summary
        ? "A bounded authorized database read succeeded."
        : "The bounded database health read is unavailable.",
      evidence: summary ? "Live database-derived evidence" : "No current evidence",
    },
    {
      label: "Authentication",
      state: "OPERATIONAL",
      description:
        "The current session and active platform authorization were validated.",
      evidence: "Live current-session evidence; OAuth and Auth email are not live-probed",
    },
    {
      label: "Transactional email",
      state: !emailConfigured
        ? "DEGRADED"
        : !summary
          ? "UNKNOWN"
          : summary.email.failed > 0 || staleEmails > 0
            ? "ATTENTION"
            : "OPERATIONAL",
      description: !emailConfigured
        ? "The selected application email provider is not fully configured."
        : !summary
          ? "Outbox evidence is currently unavailable."
          : summary.email.failed > 0 || staleEmails > 0
            ? "Provider configuration is present, but outbox events need attention."
            : "Provider configuration and current outbox evidence are normal.",
      evidence: `${configuration.primaryEmailProvider.label} primary · Resend ${configuration.standbyEmailProvider.configured ? "configured standby" : "standby configuration unknown"}`,
    },
  ];
}

function buildAttentionItems({
  summary,
  mfa,
  configuration,
  securityActivityAvailable,
}: BuildAdminHealthViewInput): AdminHealthAttentionItem[] {
  const items: AdminHealthAttentionItem[] = [];

  if (!summary) {
    items.push({
      id: "database-unavailable",
      severity: "CRITICAL",
      title: "Database health unavailable",
      description: "Platform aggregates and integrity signals could not be checked.",
    });
  }

  if (
    !configuration.supabasePublicConfigured ||
    !configuration.supabaseServiceConfigured ||
    !configuration.canonicalDomainConfigured
  ) {
    items.push({
      id: "application-configuration",
      severity: "CRITICAL",
      title: "Application configuration incomplete",
      description:
        "One or more required production configuration categories are missing.",
    });
  }

  if (!configuration.primaryEmailProvider.configured) {
    items.push({
      id: "email-configuration",
      severity: "CRITICAL",
      title: "Transactional email configuration incomplete",
      description: "The selected provider or sender configuration is unavailable.",
      href: "/admin/emails",
    });
  }

  if (summary?.email.failed) {
    items.push({
      id: "failed-emails",
      severity: "ATTENTION",
      title: `${summary.email.failed} failed transactional ${summary.email.failed === 1 ? "email" : "emails"}`,
      description: "Provider acceptance was not recorded for these events.",
      href: "/admin/emails",
    });
  }

  const staleEmails = summary
    ? summary.email.stale_pending + summary.email.stale_sending
    : 0;
  if (summary && staleEmails > 0) {
    items.push({
      id: "stale-emails",
      severity: "ATTENTION",
      title: `${staleEmails} stale outbox ${staleEmails === 1 ? "event" : "events"}`,
      description: `Pending or sending for longer than ${summary.stale_email_threshold_minutes} minutes. Historical events remain visible and are never replayed automatically.`,
      href: "/admin/emails",
    });
  }

  if (summary?.issues.open) {
    items.push({
      id: "open-issues",
      severity: "ATTENTION",
      title: `${summary.issues.open} open booking ${summary.issues.open === 1 ? "issue" : "issues"}`,
      description: "Operational issues remain unresolved.",
      href: "/admin/issues?status=OPEN",
    });
  }

  if (summary?.bookings.overdue) {
    items.push({
      id: "overdue-bookings",
      severity: "INFORMATIONAL",
      title: `${summary.bookings.overdue} overdue active ${summary.bookings.overdue === 1 ? "booking" : "bookings"}`,
      description: "This is an operational workload signal, not a security incident.",
      href: "/admin/bookings?filter=overdue",
    });
  }

  if (!mfa || mfa.verifiedFactors.length === 0) {
    items.push({
      id: "mfa",
      severity: "ATTENTION",
      title: mfa
        ? "Multi-factor authentication is not configured"
        : "Multi-factor authentication status unavailable",
      description: "Privileged platform actions require additional verification.",
    });
  }

  if (summary?.admins.active === 1) {
    items.push({
      id: "admin-resilience",
      severity: "ATTENTION",
      title: "Only one active platform administrator exists",
      description: "This is an account-recovery and operational-resilience concern.",
    });
  }

  if (!securityActivityAvailable) {
    items.push({
      id: "security-activity",
      severity: "INFORMATIONAL",
      title: "Recent security activity unavailable",
      description: "Other current health evidence remains available.",
    });
  }

  const severityOrder = { CRITICAL: 0, ATTENTION: 1, INFORMATIONAL: 2 } as const;
  return items.sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity],
  );
}

export function buildAdminHealthView(input: BuildAdminHealthViewInput): AdminHealthView {
  const services = buildServices(input);
  const attentionItems = buildAttentionItems(input);

  let overall: AdminHealthState = "OPERATIONAL";
  if (services.some((service) => service.state === "DEGRADED")) {
    overall = "DEGRADED";
  } else if (
    services.some((service) => service.state === "UNKNOWN") ||
    !input.securityActivityAvailable
  ) {
    overall = "UNKNOWN";
  } else if (
    services.some((service) => service.state === "ATTENTION") ||
    attentionItems.some((item) => item.severity !== "INFORMATIONAL")
  ) {
    overall = "ATTENTION";
  }

  const criticalSecuritySignal =
    !input.mfa ||
    input.mfa.verifiedFactors.length === 0 ||
    (input.summary !== null && input.summary.admins.active === 0);

  return {
    overall,
    services,
    attentionItems,
    securityStatement: criticalSecuritySignal
      ? "Current admin account protection requires attention."
      : "No current critical platform-security signal was detected by the available checks.",
  };
}

export function getSecurityActivityLabel(
  eventType: AdminSecurityActivityItem["event_type"],
) {
  switch (eventType) {
    case "PLATFORM_ADMIN_CREATED":
      return "Platform administrator created";
    case "PLATFORM_ADMIN_UPDATED":
      return "Platform administrator updated";
    case "PLATFORM_ADMIN_DISABLED":
      return "Platform administrator disabled";
    case "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED":
      return "Failed-email retry requested";
    case "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED":
      return "Failed-email retry accepted by provider";
    case "PLATFORM_ADMIN_EMAIL_RETRY_FAILED":
      return "Failed-email retry failed";
  }
}
