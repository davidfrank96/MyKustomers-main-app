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
  Mail,
  MailWarning,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { getAdminAttentionItems, type AdminOverview } from "@/features/admin/overview";
import { getAdminOverview } from "@/features/admin/queries";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Platform operations",
};

type Metric = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  href?: Route;
  attention?: boolean;
};

const integerFormatter = new Intl.NumberFormat("en");
const refreshedAtFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function FormattedCount({ value }: { value: number }) {
  const groups = integerFormatter.format(value).split(",");
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

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            data-admin-metric={metric.label}
            data-attention={metric.attention || undefined}
            className={cn(
              "relative grid min-h-36 min-w-0 grid-cols-[44px_minmax(0,1fr)] content-start gap-x-4 rounded-lg border bg-card p-5",
              metric.attention
                ? "border-destructive/35 bg-destructive/[0.025]"
                : "border-border",
              metric.href &&
                "hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring",
            )}
          >
            <dt className="contents">
              <span
                className={cn(
                  "row-span-2 flex size-11 items-center justify-center rounded-md",
                  metric.attention
                    ? "bg-destructive/5 text-destructive"
                    : "bg-primary/[0.07] text-primary",
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "min-w-0 break-words text-sm font-medium",
                  metric.attention && "text-destructive",
                )}
              >
                {metric.href ? (
                  <Link
                    href={metric.href}
                    className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                  >
                    {metric.label}
                  </Link>
                ) : (
                  metric.label
                )}
              </span>
            </dt>
            <dd
              className={cn(
                "col-start-2 mt-1 min-w-0",
                metric.attention && "text-destructive",
              )}
            >
              <span className="block break-words text-[32px] font-semibold leading-tight tabular-nums">
                <FormattedCount value={metric.value} />
              </span>
              <span className="mt-2 block text-xs leading-[18px] text-muted-foreground">
                {metric.description}
              </span>
            </dd>
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
      attention: overview.overdue > 0,
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
  const needsAttention = attentionItems.some((item) => item.value > 0);

  return (
    <section aria-labelledby="admin-overview-title" className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase leading-5 text-primary">
            Platform Operations
          </p>
          <h1
            id="admin-overview-title"
            className="mt-1 text-[32px] font-semibold leading-tight"
          >
            Overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Platform-wide scale, booking operations, and delivery exceptions.
          </p>
        </div>
        <p className="flex min-w-0 items-start gap-2 text-xs leading-6 text-muted-foreground sm:text-sm">
          <RefreshCw className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            Last refreshed{" "}
            <time dateTime={overview.refreshed_at}>
              {refreshedAtFormatter.format(new Date(overview.refreshed_at))} UTC
            </time>
          </span>
        </p>
      </div>

      <section aria-labelledby="platform-scale-title" className="pt-6">
        <h2 id="platform-scale-title" className="text-base font-semibold">
          Platform scale
        </h2>
        <MetricGrid metrics={platformMetrics(overview)} />
      </section>

      <section aria-labelledby="booking-operations-title" className="pt-5">
        <h2 id="booking-operations-title" className="text-base font-semibold">
          Booking operations
        </h2>
        <MetricGrid metrics={operationsMetrics(overview)} />
      </section>

      <section
        aria-labelledby="attention-title"
        data-attention={needsAttention || undefined}
        className={cn(
          "mt-5 rounded-lg border p-3 sm:p-4",
          needsAttention
            ? "border-destructive/35 bg-destructive/[0.02]"
            : "border-border bg-card",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 shrink-0",
              needsAttention ? "text-destructive" : "text-primary",
            )}
          >
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="attention-title"
              className={cn(
                "text-base font-semibold",
                needsAttention && "text-destructive",
              )}
            >
              Needs attention
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Current operational exceptions across the platform.
            </p>
          </div>
        </div>
        <dl className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
          {attentionItems.map((item) => {
            const Icon =
              item.label === "Failed emails"
                ? Mail
                : item.label === "Open booking issues"
                  ? AlertTriangle
                  : CalendarClock;
            return (
              <div
                key={item.label}
                data-admin-metric={item.label}
                data-attention={item.value > 0 || undefined}
                className={cn(
                  "relative grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]",
                  item.label === "Open booking issues" &&
                    "hover:bg-muted/40 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring",
                )}
              >
                <dt className="flex min-w-0 items-center gap-3 text-xs font-semibold">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      item.value > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  {item.label === "Open booking issues" ? (
                    <Link
                      href="/admin/issues?status=OPEN"
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </dt>
                <dd className="contents">
                  <span className="col-start-1 row-start-2 mt-1 min-w-0 pl-7 text-xs leading-5 text-muted-foreground md:col-start-2 md:row-start-1 md:mt-0 md:pl-0">
                    {item.description}
                  </span>
                  <span
                    className={cn(
                      "col-start-2 row-span-2 row-start-1 max-w-28 break-words text-right text-lg font-semibold tabular-nums md:col-start-3",
                      item.value > 0 && "text-destructive",
                    )}
                  >
                    <FormattedCount value={item.value} />
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <div className="grid min-w-0 gap-4 pt-4 lg:grid-cols-2">
        <section
          aria-labelledby="email-outbox-title"
          className="min-w-0 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <MailWarning className="size-5 text-primary" aria-hidden="true" />
            <h2 id="email-outbox-title" className="text-base font-semibold">
              Email outbox
            </h2>
          </div>
          <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-md border border-border">
            {[
              { label: "Pending", value: overview.email_pending, icon: Clock3 },
              { label: "Sending", value: overview.email_sending, icon: Send },
              { label: "Sent", value: overview.email_sent, icon: CheckCircle2 },
              { label: "Failed", value: overview.email_failed, icon: CircleAlert },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                data-admin-metric={`Email ${label}`}
                data-attention={(label === "Failed" && value > 0) || undefined}
                className="relative min-w-0 border-border p-3 odd:border-r [&:nth-child(-n+2)]:border-b sm:px-5"
              >
                <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  {label}
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      label === "Failed" && value > 0
                        ? "text-destructive"
                        : "text-primary",
                    )}
                    aria-hidden="true"
                  />
                </dt>
                <dd
                  className={cn(
                    "mt-1 break-words text-2xl font-semibold tabular-nums",
                    label === "Failed" && value > 0 && "text-destructive",
                  )}
                >
                  <FormattedCount value={value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="system-status-title"
          className="min-w-0 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <h2 id="system-status-title" className="text-base font-semibold">
                System status
              </h2>
            </div>
            <Link
              href="/admin/security"
              className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary hover:underline lg:-my-2.5"
            >
              View security &amp; health
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <dl className="mt-3 divide-y divide-border rounded-md border border-border">
            <div className="grid min-h-[49px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <Database className="size-4 text-muted-foreground" aria-hidden="true" />
                Database read
              </dt>
              <dd className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                Available
              </dd>
            </div>
            <div className="grid min-h-[49px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <ShieldCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Admin authorization
              </dt>
              <dd className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                Verified
              </dd>
            </div>
            <div className="grid min-h-[49px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 py-3">
              <dt className="flex items-center gap-2 text-sm">
                <MailCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                Email outbox
              </dt>
              <dd
                className={cn(
                  "min-w-0 break-words text-right text-sm font-medium",
                  overview.email_failed > 0 && "text-destructive",
                )}
              >
                <FormattedCount value={overview.email_failed} /> failed,{" "}
                <FormattedCount value={overview.email_pending} /> pending
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
