import {
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
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
import { Fragment } from "react";
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
    className: "border-primary/30 bg-primary/5 text-primary",
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
      className={`inline-flex min-h-6 w-fit shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${presentation.className}`}
      data-health-state={state}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
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
    <article className="min-w-0 border-border p-3 max-md:border-b md:odd:border-r md:[&:nth-child(-n+2)]:border-b last:border-b-0">
      <div className="grid min-h-10 grid-cols-1 items-start gap-2 min-[400px]:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="min-w-0 break-words text-[13px] font-semibold leading-5">
            {service.label}
          </h3>
        </div>
        <StatusBadge state={service.state} />
      </div>
      <p className="mt-2 text-sm leading-5 [overflow-wrap:anywhere]">
        {service.description}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        {service.evidence}
      </p>
    </article>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "failure" | "attention";
}) {
  return (
    <div
      data-health-metric={label}
      data-metric-tone={value > 0 ? tone : undefined}
      className="min-w-0 p-3"
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span
          className={`block break-words text-2xl font-semibold tabular-nums ${value > 0 && tone === "failure" ? "text-destructive" : value > 0 && tone === "attention" ? "text-[#71351f]" : ""}`}
        >
          <Count value={value} />
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {detail}
        </span>
      </dd>
    </div>
  );
}

function Count({ value }: { value: number }) {
  const groups = numberFormatter.format(value).split(",");
  return groups.map((group, index) => (
    <Fragment key={index}>
      {group}
      {index < groups.length - 1 ? (
        <>
          ,<wbr />
        </>
      ) : null}
    </Fragment>
  ));
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
    <div className="min-w-0 space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase leading-5 text-primary">
          Platform operations
        </p>
        <div className="mt-1 flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">
              Security &amp; Health
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Current read-only service, security, and operational evidence for the
              platform.
            </p>
          </div>
          <AdminHealthRefresh />
        </div>
      </header>

      <section
        aria-labelledby="health-summary-title"
        className="rounded-lg border border-border bg-card"
      >
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="min-w-0 p-4">
            <h2
              id="health-summary-title"
              className="text-sm font-medium text-muted-foreground"
            >
              Platform status
            </h2>
            <div className="mt-2">
              <StatusBadge state={view.overall} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {view.securityStatement}
            </p>
          </div>
          <div className="min-w-0 p-4">
            <p className="text-sm font-medium text-muted-foreground">Needs attention</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {numberFormatter.format(view.attentionItems.length)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Items require review.
            </p>
          </div>
          <div className="min-w-0 p-4">
            <p className="text-sm font-medium text-muted-foreground">Last checked</p>
            <p className="mt-2 text-sm font-medium [overflow-wrap:anywhere]">
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
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0 space-y-4">
          <section
            aria-labelledby="health-attention-title"
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="size-5 shrink-0 text-[#a6531c]"
                aria-hidden="true"
              />
              <div>
                <h2 id="health-attention-title" className="text-base font-semibold">
                  Needs attention
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current anomalies and resilience concerns, ordered by severity.
                </p>
              </div>
            </div>
            {view.attentionItems.length > 0 ? (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {view.attentionItems.map((item) => {
                  const content = (
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-start">
                      <Badge
                        variant={item.severity === "CRITICAL" ? "default" : "outline"}
                        className={`w-fit self-start rounded px-1.5 py-0.5 text-xs ${
                          item.severity === "CRITICAL"
                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                            : item.severity === "ATTENTION"
                              ? "border-[#c97832]/35 bg-[#fff5ea] text-[#71351f]"
                              : "border-blue-200 bg-blue-50 text-blue-900"
                        }`}
                      >
                        {item.severity === "INFORMATIONAL"
                          ? "Informational"
                          : item.severity === "ATTENTION"
                            ? "Attention"
                            : "Critical"}
                      </Badge>
                      <div className="col-start-1 row-start-2 min-w-0 [overflow-wrap:anywhere] sm:col-start-2 sm:row-start-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      {item.href ? (
                        <ChevronRight
                          className="col-start-2 row-span-2 row-start-1 size-4 self-center text-primary sm:col-start-3"
                          aria-hidden="true"
                        />
                      ) : null}
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

          <section
            aria-labelledby="core-services-title"
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <h2 id="core-services-title" className="text-base font-semibold">
              Core services
            </h2>
            <div className="mt-3 grid border-t border-border md:grid-cols-2">
              {view.services.map((service) => (
                <ServiceCard key={service.label} service={service} />
              ))}
            </div>
          </section>

          <AccountSecurity admin={admin} mfa={mfa} />
        </div>
        <div className="min-w-0 space-y-4">
          <section
            aria-labelledby="email-health-title"
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" aria-hidden="true" />
              <h2 id="email-health-title" className="text-base font-semibold">
                Email delivery
              </h2>
            </div>
            {summary ? (
              <dl className="mt-3 grid grid-cols-2 rounded-md border border-border [&>div]:border-border [&>div:nth-child(odd)]:border-r [&>div:nth-child(-n+2)]:border-b xl:grid-cols-4 xl:[&>div]:border-b-0 xl:[&>div:not(:last-child)]:border-r">
                <Metric
                  label="Accepted in 24h"
                  value={summary.email.accepted_24h}
                  detail="Provider acceptance, not recipient delivery."
                />
                <Metric
                  label="Failed"
                  value={summary.email.failed}
                  tone="failure"
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
                  tone="attention"
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
              className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              View Email Operations
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>

          <section
            aria-labelledby="integrity-title"
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Database className="size-5 text-primary" aria-hidden="true" />
              <h2 id="integrity-title" className="text-base font-semibold">
                Operational integrity
              </h2>
            </div>
            {summary ? (
              <dl className="mt-3 grid divide-y divide-border rounded-md border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
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
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Referential relationships already enforced by PostgreSQL foreign keys are
              not redundantly scanned on each page load. Phase 7 detects; it does not
              repair.
            </p>
          </section>

          <section
            aria-labelledby="security-activity-title"
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-primary" aria-hidden="true" />
              <h2 id="security-activity-title" className="text-base font-semibold">
                Security activity
              </h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Recent allowlisted platform-admin and privileged-email activity. Routine
              page views and tenant audit noise are excluded.
            </p>
            {activity ? (
              activity.items.length > 0 ? (
                <div
                  role="region"
                  aria-label="Recent security activity"
                  tabIndex={0}
                  className="mt-3 min-w-0 rounded-md border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:max-h-[400px] md:overflow-y-auto md:overscroll-contain"
                >
                  <ol className="divide-y divide-border">
                    {activity.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid min-w-0 gap-1 px-3 py-2 [overflow-wrap:anywhere] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.15fr)] md:gap-x-3"
                      >
                        <time
                          dateTime={item.created_at}
                          className="order-2 text-xs leading-5 text-muted-foreground md:order-none"
                        >
                          {timestampFormatter.format(new Date(item.created_at))} UTC
                        </time>
                        <div className="min-w-0 md:contents">
                          <p className="text-sm font-medium md:col-start-2">
                            {getSecurityActivityLabel(item.event_type)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground md:col-start-3 md:mt-0">
                            Actor: {actorLabel(item)}
                          </p>
                          {item.reason ? (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground md:col-span-2 md:col-start-2">
                              Reason: {item.reason}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
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

          <TechnicalContext configuration={configuration} />
        </div>
      </div>
    </div>
  );
}

function AccountSecurity({
  admin,
  mfa,
}: {
  admin: PlatformAdminAccess;
  mfa: AdminMfaSecurityStatus | null;
}) {
  return (
    <section
      aria-labelledby="admin-account-security-title"
      className="min-w-0 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-primary" aria-hidden="true" />
        <h2 id="admin-account-security-title" className="text-base font-semibold">
          Admin account security
        </h2>
      </div>
      <dl className="mt-3 grid divide-y divide-border rounded-md border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 [&>div]:min-w-0">
        <div className="p-3">
          <dt className="text-sm text-muted-foreground">Platform role</dt>
          <dd className="mt-2 font-semibold">Super Admin</dd>
        </div>
        <div className="p-3">
          <dt className="text-sm text-muted-foreground">Account status</dt>
          <dd
            className={`mt-2 text-sm font-semibold ${admin.status === "ACTIVE" ? "text-primary" : ""}`}
          >
            {admin.status === "ACTIVE" ? "Active" : "Unknown"}
          </dd>
        </div>
        <div className="p-3">
          <dt className="text-sm text-muted-foreground">Additional verification</dt>
          <dd
            className={`mt-2 text-sm font-semibold ${mfa?.verifiedFactors.length ? "text-primary" : mfa ? "text-[#71351f]" : ""}`}
          >
            {mfa?.verifiedFactors.length
              ? "Configured"
              : mfa
                ? "Not configured"
                : "Unknown"}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        {mfa ? (
          <AdminMfaSecurity status={mfa} />
        ) : (
          <p className="border-y border-border py-5 text-sm text-muted-foreground">
            Administrator MFA information is currently unavailable.
          </p>
        )}
      </div>
    </section>
  );
}

function TechnicalContext({
  configuration,
}: {
  configuration: AdminRuntimeConfiguration;
}) {
  return (
    <section
      aria-labelledby="support-context-title"
      className="min-w-0 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <ServerCog className="size-5 text-primary" aria-hidden="true" />
        <h2 id="support-context-title" className="text-base font-semibold">
          Technical context
        </h2>
      </div>
      <dl className="mt-3 divide-y divide-border rounded-md border border-border">
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
            className="grid min-w-0 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-start sm:gap-3"
          >
            <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-xs font-medium leading-5 [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Configuration presence does not prove credential validity. Supabase Auth email,
        Google OAuth, DNS authentication, dependency security, and performance remain
        release-verification or external-observability evidence rather than automatic page
        probes.
      </p>
    </section>
  );
}
