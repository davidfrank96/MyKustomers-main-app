import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ContactRound,
  Database,
  MailCheck,
  MailWarning,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getAdminAttentionItems, type AdminOverview } from "@/features/admin/overview";
import { getAdminOverview } from "@/features/admin/queries";

export const metadata: Metadata = {
  title: "Platform operations",
};

type Metric = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  href?: Route;
};

const integerFormatter = new Intl.NumberFormat("en");
const refreshedAtFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        const content = (
          <div data-admin-metric={metric.label} className="min-h-36 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <dt className="text-sm font-medium">{metric.label}</dt>
            </div>
            <dd className="mt-4 text-3xl font-semibold tabular-nums text-foreground">
              {integerFormatter.format(metric.value)}
            </dd>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {metric.description}
            </p>
          </div>
        );

        return (
          <div key={metric.label} className="border-b border-r border-border bg-card">
            {metric.href ? (
              <Link
                href={metric.href}
                className="block transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {content}
              </Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </dl>
  );
}

function platformMetrics(overview: AdminOverview): Metric[] {
  return [
    {
      label: "Businesses",
      value: overview.businesses,
      description: "All business workspaces.",
      icon: Building2,
      href: "/admin/businesses",
    },
    {
      label: "Platform users",
      value: overview.platform_users,
      description: "Provisioned user profiles.",
      icon: Users,
      href: "/admin/users",
    },
    {
      label: "Customers",
      value: overview.customers,
      description: "Customer records across businesses.",
      icon: ContactRound,
    },
    {
      label: "Bookings",
      value: overview.bookings,
      description: "Current booking records.",
      icon: CalendarCheck2,
      href: "/admin/bookings",
    },
  ];
}

function operationsMetrics(overview: AdminOverview): Metric[] {
  return [
    {
      label: "Active bookings",
      value: overview.active_bookings,
      description: "Not completed or cancelled.",
      icon: CalendarClock,
      href: "/admin/bookings?filter=active",
    },
    {
      label: "Due today",
      value: overview.due_today,
      description: "Scheduled today in UTC and still active.",
      icon: Clock3,
      href: "/admin/bookings?filter=due_today",
    },
    {
      label: "Overdue",
      value: overview.overdue,
      description: "Past due and not delivered or closed.",
      icon: AlertTriangle,
      href: "/admin/bookings?filter=overdue",
    },
    {
      label: "Completed",
      value: overview.completed,
      description: "Bookings in the completed state.",
      icon: CheckCircle2,
      href: "/admin/bookings?filter=completed",
    },
  ];
}

export default async function AdminPage() {
  const overview = await getAdminOverview();
  const attentionItems = getAdminAttentionItems(overview);

  return (
    <section aria-labelledby="admin-overview-title">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Platform Operations</p>
          <h1 id="admin-overview-title" className="mt-2 text-3xl font-semibold">
            Overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Platform-wide scale, booking operations, and delivery exceptions.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Last refreshed{" "}
          <time dateTime={overview.refreshed_at}>
            {refreshedAtFormatter.format(new Date(overview.refreshed_at))} UTC
          </time>
        </p>
      </div>

      <section aria-labelledby="platform-scale-title" className="pt-8">
        <h2 id="platform-scale-title" className="text-lg font-semibold">
          Platform scale
        </h2>
        <MetricGrid metrics={platformMetrics(overview)} />
      </section>

      <section aria-labelledby="booking-operations-title" className="pt-8">
        <h2 id="booking-operations-title" className="text-lg font-semibold">
          Booking operations
        </h2>
        <MetricGrid metrics={operationsMetrics(overview)} />
      </section>

      <section
        aria-labelledby="attention-title"
        className="mt-8 border-y border-border py-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="attention-title" className="text-lg font-semibold">
              Needs attention
            </h2>
            <p className="text-sm text-muted-foreground">
              Current operational exceptions across the platform.
            </p>
          </div>
        </div>
        <dl className="mt-5 divide-y divide-border border-y border-border">
          {attentionItems.map((item) => {
            const content = (
              <>
                <div>
                  <dt className="font-medium">{item.label}</dt>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <dd className="text-2xl font-semibold tabular-nums">
                  {integerFormatter.format(item.value)}
                </dd>
              </>
            );
            const className =
              "grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 py-4";
            return item.label === "Open booking issues" ? (
              <Link
                key={item.label}
                href="/admin/issues?status=OPEN"
                data-admin-metric={item.label}
                className={`${className} transition-colors hover:bg-muted/40 sm:px-3`}
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} data-admin-metric={item.label} className={className}>
                {content}
              </div>
            );
          })}
        </dl>
      </section>

      <div className="grid gap-8 pt-8 lg:grid-cols-2">
        <section aria-labelledby="email-outbox-title">
          <div className="flex items-center gap-2">
            <MailWarning className="size-5 text-primary" aria-hidden="true" />
            <h2 id="email-outbox-title" className="text-lg font-semibold">
              Email outbox
            </h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 border-l border-t border-border">
            {[
              ["Pending", overview.email_pending],
              ["Sending", overview.email_sending],
              ["Sent", overview.email_sent],
              ["Failed", overview.email_failed],
            ].map(([label, value]) => (
              <div
                key={label}
                data-admin-metric={`Email ${label}`}
                className="border-b border-r border-border bg-card p-4"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {integerFormatter.format(value as number)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="system-status-title">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <h2 id="system-status-title" className="text-lg font-semibold">
                System status
              </h2>
            </div>
            <Link
              href="/admin/security"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              View security &amp; health
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <Database className="size-4 text-muted-foreground" aria-hidden="true" />
                Database read
              </dt>
              <dd className="font-medium text-foreground">Available</dd>
            </div>
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <ShieldCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Admin authorization
              </dt>
              <dd className="font-medium text-foreground">Verified</dd>
            </div>
            <div className="flex min-h-16 items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <MailCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                Email outbox
              </dt>
              <dd className="text-right text-sm font-medium">
                {integerFormatter.format(overview.email_failed)} failed,{" "}
                {integerFormatter.format(overview.email_pending)} pending
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
