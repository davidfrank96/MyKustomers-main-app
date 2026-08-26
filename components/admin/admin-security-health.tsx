import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Database,
  HeartPulse,
  KeyRound,
  Mail,
  ServerCog,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AdminHealthRefresh } from "@/components/admin/admin-health-refresh";
import { AdminMfaSecurity } from "@/components/admin/admin-mfa-security";
import { Badge } from "@/components/ui/badge";
import {
  buildAdminHealthView,
  getSecurityActivityLabel,
  type AdminHealthService,
  type AdminHealthState,
  type AdminHealthSummary,
  type AdminRuntimeConfiguration,
  type AdminSecurityActivity,
} from "@/features/admin/health";
import type { AdminMfaSecurityStatus } from "@/features/admin/security";
import type { PlatformAdminAccess } from "@/lib/admin/access-policy";

const numberFormatter = new Intl.NumberFormat("en");
const timestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const statePresentation: Record<
  AdminHealthState,
  { label: string; className: string; icon: LucideIcon }
> = {
  OPERATIONAL: {
    label: "Operational",
    className: "border-primary/30 bg-primary/5 text-foreground",
    icon: CheckCircle2,
  },
  ATTENTION: {
    label: "Attention",
    className: "border-[#c97832]/35 bg-[#fff5ea] text-[#71351f]",
    icon: AlertTriangle,
  },
  DEGRADED: {
    label: "Degraded",
    className: "border-destructive/30 bg-destructive/5 text-destructive",
    icon: ShieldAlert,
  },
  UNKNOWN: {
    label: "Unknown",
    className: "border-border bg-muted text-muted-foreground",
    icon: CircleHelp,
  },
};

function StatusBadge({ state }: { state: AdminHealthState }) {
  const presentation = statePresentation[state];
  const Icon = presentation.icon;

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 border px-3 text-sm font-medium ${presentation.className}`}
      data-health-state={state}
    >
      <Icon className="size-4" aria-hidden="true" />
      {presentation.label}
    </span>
  );
}

function ServiceCard({ service }: { service: AdminHealthService }) {
  const icons: Record<string, LucideIcon> = {
    Application: HeartPulse,
    Database,
    Authentication: UserRoundCheck,
    "Transactional email": Mail,
  };
  const Icon = icons[service.label] ?? ServerCog;

  return (
    <article className="min-h-48 border-b border-r border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">{service.label}</h3>
        </div>
        <StatusBadge state={service.state} />
      </div>
      <p className="mt-5 text-sm leading-6 text-foreground">{service.description}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{service.evidence}</p>
    </article>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="min-h-32 border-b border-r border-border bg-card p-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-3 text-2xl font-semibold tabular-nums">
        {numberFormatter.format(value)}
      </dd>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function actorLabel(item: AdminSecurityActivity["items"][number]) {
  if (item.actor.display_name) return item.actor.display_name;
  if (item.actor.email) return item.actor.email;
  if (item.actor.source === "CONTROLLED_DATABASE_OPERATOR") {
    return "Controlled database operator";
  }
  return "Recorded authenticated actor";
}

export function AdminSecurityHealth({
  admin,
  summary,
  activity,
  mfa,
  configuration,
}: {
  admin: PlatformAdminAccess;
  summary: AdminHealthSummary | null;
  activity: AdminSecurityActivity | null;
  mfa: AdminMfaSecurityStatus | null;
  configuration: AdminRuntimeConfiguration;
}) {
  const view = buildAdminHealthView({
    summary,
    mfa,
    configuration,
    securityActivityAvailable: activity !== null,
  });
  const checkedAt = summary?.checked_at ?? null;

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform operations</p>
        <div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Security &amp; Health</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Current read-only service, security, and operational evidence for the
              platform.
            </p>
          </div>
          <AdminHealthRefresh />
        </div>
      </header>

      <section
        aria-labelledby="health-summary-title"
        className="border-y border-border py-6"
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <h2
              id="health-summary-title"
              className="text-sm font-medium text-muted-foreground"
            >
              Platform status
            </h2>
            <div className="mt-3">
              <StatusBadge state={view.overall} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Needs attention</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {numberFormatter.format(view.attentionItems.length)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last checked</p>
            <p className="mt-2 text-sm font-semibold">
              {checkedAt ? (
                <time dateTime={checkedAt}>
                  {timestampFormatter.format(new Date(checkedAt))} UTC
                </time>
              ) : (
                "Unavailable"
              )}
            </p>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
          {view.securityStatement}
        </p>
      </section>

      <section aria-labelledby="health-attention-title">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-[#a6531c]" aria-hidden="true" />
          <div>
            <h2 id="health-attention-title" className="text-lg font-semibold">
              Needs attention
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current anomalies and resilience concerns, ordered by severity.
            </p>
          </div>
        </div>
        {view.attentionItems.length > 0 ? (
          <ul className="mt-5 divide-y divide-border border-y border-border">
            {view.attentionItems.map((item) => {
              const content = (
                <div className="grid min-h-20 gap-2 py-4 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-5">
                  <Badge
                    variant={item.severity === "CRITICAL" ? "default" : "outline"}
                    className={
                      item.severity === "CRITICAL"
                        ? "bg-destructive text-white"
                        : item.severity === "ATTENTION"
                          ? "border-[#c97832]/35 bg-[#fff5ea] text-[#71351f]"
                          : undefined
                    }
                  >
                    {item.severity === "INFORMATIONAL"
                      ? "Informational"
                      : item.severity === "ATTENTION"
                        ? "Attention"
                        : "Critical"}
                  </Badge>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block px-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 border-y border-border py-5 text-sm text-muted-foreground">
            No current attention signal was detected by the available checks.
          </p>
        )}
      </section>

      <section aria-labelledby="core-services-title">
        <h2 id="core-services-title" className="text-lg font-semibold">
          Core services
        </h2>
        <div className="mt-4 grid border-l border-t border-border md:grid-cols-2">
          {view.services.map((service) => (
            <ServiceCard key={service.label} service={service} />
          ))}
        </div>
      </section>

      <section aria-labelledby="email-health-title">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-primary" aria-hidden="true" />
          <h2 id="email-health-title" className="text-lg font-semibold">
            Email delivery
          </h2>
        </div>
        {summary ? (
          <dl className="mt-4 grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
            <Metric
              label="Accepted in 24h"
              value={summary.email.accepted_24h}
              detail="Provider acceptance, not recipient delivery."
            />
            <Metric
              label="Failed"
              value={summary.email.failed}
              detail="Current failed outbox events."
            />
            <Metric
              label="Pending"
              value={summary.email.pending}
              detail="Waiting for processing."
            />
            <Metric
              label="Stale"
              value={summary.email.stale_pending + summary.email.stale_sending}
              detail={`Older than ${summary.stale_email_threshold_minutes} minutes.`}
            />
          </dl>
        ) : (
          <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
            Email health evidence is unavailable.
          </p>
        )}
        <Link
          href="/admin/emails"
          className="mt-4 inline-flex min-h-11 items-center font-medium text-primary"
        >
          View Email Operations
        </Link>
      </section>

      <section aria-labelledby="integrity-title">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-primary" aria-hidden="true" />
          <h2 id="integrity-title" className="text-lg font-semibold">
            Operational integrity
          </h2>
        </div>
        {summary ? (
          <dl className="mt-4 grid border-l border-t border-border sm:grid-cols-2">
            <Metric
              label="Open booking issues"
              value={summary.issues.open}
              detail={`${summary.issues.created_24h} created in the last 24 hours.`}
            />
            <Metric
              label="Overdue active bookings"
              value={summary.bookings.overdue}
              detail="Operational workload, not a platform-security finding."
            />
          </dl>
        ) : (
          <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
            Integrity aggregates are unavailable.
          </p>
        )}
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Referential relationships already enforced by PostgreSQL foreign keys are not
          redundantly scanned on each page load. Phase 7 detects; it does not repair.
        </p>
      </section>

      <section aria-labelledby="security-activity-title">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden="true" />
          <h2 id="security-activity-title" className="text-lg font-semibold">
            Security activity
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Recent allowlisted platform-admin and privileged-email activity. Routine page
          views and tenant audit noise are excluded.
        </p>
        {activity ? (
          activity.items.length > 0 ? (
            <ol className="mt-5 divide-y divide-border border-y border-border">
              {activity.items.map((item) => (
                <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr]">
                  <time
                    dateTime={item.created_at}
                    className="text-sm text-muted-foreground"
                  >
                    {timestampFormatter.format(new Date(item.created_at))} UTC
                  </time>
                  <div>
                    <p className="font-medium">
                      {getSecurityActivityLabel(item.event_type)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Actor: {actorLabel(item)}
                    </p>
                    {item.reason ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Reason: {item.reason}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 border-y border-border py-5 text-sm text-muted-foreground">
              No allowlisted platform-security activity is currently recorded.
            </p>
          )
        ) : (
          <p className="mt-5 border-y border-border py-5 text-sm text-muted-foreground">
            Recent security activity is unavailable. Other health evidence remains
            visible.
          </p>
        )}
      </section>

      <section aria-labelledby="admin-account-security-title">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" aria-hidden="true" />
          <h2 id="admin-account-security-title" className="text-lg font-semibold">
            Admin account security
          </h2>
        </div>
        <dl className="mt-4 grid border-l border-t border-border sm:grid-cols-3">
          <div className="border-b border-r border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">Platform role</dt>
            <dd className="mt-2 font-semibold">Super Admin</dd>
          </div>
          <div className="border-b border-r border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">Account status</dt>
            <dd className="mt-2 font-semibold">
              {admin.status === "ACTIVE" ? "Active" : "Unknown"}
            </dd>
          </div>
          <div className="border-b border-r border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">Additional verification</dt>
            <dd className="mt-2 font-semibold">
              {mfa?.verifiedFactors.length
                ? "Configured"
                : mfa
                  ? "Not configured"
                  : "Unknown"}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          {mfa ? (
            <AdminMfaSecurity status={mfa} />
          ) : (
            <p className="border-y border-border py-5 text-sm text-muted-foreground">
              Administrator MFA information is currently unavailable.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="support-context-title">
        <div className="flex items-center gap-2">
          <ServerCog className="size-5 text-primary" aria-hidden="true" />
          <h2 id="support-context-title" className="text-lg font-semibold">
            Technical context
          </h2>
        </div>
        <dl className="mt-4 divide-y divide-border border-y border-border">
          {[
            ["Environment", configuration.environment.toLowerCase()],
            ["Canonical domain", configuration.canonicalDomain],
            ["Deployment commit", configuration.deploymentCommit ?? "Unknown"],
            [
              "Primary transactional provider",
              `${configuration.primaryEmailProvider.label} · ${configuration.primaryEmailProvider.configured ? "Configured" : "Missing"}`,
            ],
            [
              "Standby provider",
              `Resend · ${configuration.standbyEmailProvider.configured ? "Configured" : "Unknown"}`,
            ],
            ["Supabase Auth email", "Not live-probed on page load"],
            ["Google OAuth", "Not live-probed on page load"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid min-h-14 gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:items-center"
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="break-words text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Configuration presence does not prove credential validity. Supabase Auth email,
          Google OAuth, DNS authentication, dependency security, and performance remain
          release-verification or external-observability evidence rather than automatic
          page probes.
        </p>
      </section>
    </div>
  );
}
