import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Info,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileRow = { title: string; description: string; icon: LucideIcon; href?: Route };
const groups: { id: string; title: string; rows: ProfileRow[] }[] = [
  {
    id: "profile-business",
    title: "Business",
    rows: [
      {
        title: "Business information",
        description: "Name, category, description, logo",
        icon: Building2,
        href: "/business/edit?section=information" as Route,
      },
      {
        title: "Contact information",
        description: "Phone, email, WhatsApp, Instagram, website",
        icon: Phone,
        href: "/business/edit?section=contact" as Route,
      },
      {
        title: "Business address",
        description: "Manage your business location",
        icon: MapPin,
        href: "/business/edit?section=address" as Route,
      },
    ],
  },
  {
    id: "profile-account",
    title: "Account",
    rows: [
      {
        title: "Account details",
        description: "Name, email, password, account security",
        icon: UserRound,
      },
      {
        title: "Notifications",
        description: "Manage your alerts and preferences",
        icon: Bell,
        href: "/settings#notifications",
      },
      {
        title: "Privacy & security",
        description: "Control your data and account access",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "profile-billing-legal",
    title: "Billing & Legal",
    rows: [
      {
        title: "Billing & subscriptions",
        description: "Plans, payments, invoices",
        icon: CreditCard,
      },
      {
        title: "Terms & conditions",
        description: "Read our terms and policies",
        icon: FileText,
      },
      {
        title: "About MyKustomers",
        description: "Learn more about our platform",
        icon: Info,
      },
    ],
  },
];

const summaryGrid =
  "grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 p-3 min-[375px]:grid-cols-[4rem_minmax(0,1fr)_auto] sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:p-4";

function ProfileSettingsRow({ title, description, icon: Icon, href }: ProfileRow) {
  const rowClassName = "flex min-h-16 items-center gap-3 py-2.5";
  const titleId = `profile-row-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted/80">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="break-words text-[0.9375rem] font-semibold leading-5">
          {title}
        </h3>
        <p
          id={`${titleId}-description`}
          className="mt-0.5 break-words text-[0.8125rem] leading-5 text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <ChevronRight
        className="size-[1.125rem] shrink-0 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </>
  );
  return (
    <li className={href ? "flex min-h-16" : rowClassName}>
      {href ? (
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 focus-visible:rounded-md"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-description`}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

export function MyProfileHub({
  business,
  isOwner,
}: {
  business: {
    name: string;
    category: string;
    logoUrl: string | null;
    createdAt?: string | null;
  };
  isOwner: boolean;
}) {
  const createdAt = business.createdAt ? new Date(business.createdAt) : null;
  const validCreatedAt =
    createdAt && Number.isFinite(createdAt.getTime()) ? createdAt : null;

  return (
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="profile-business-name" data-profile-summary>
        <Card className={summaryGrid}>
          <BusinessLogo
            name={business.name}
            url={business.logoUrl}
            className="col-start-1 row-span-2 row-start-1 size-16 rounded-lg min-[375px]:row-span-1 sm:size-20"
          />
          <div className="col-start-2 row-start-1 min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <h2
                id="profile-business-name"
                className="min-w-0 text-lg font-semibold leading-6 [overflow-wrap:anywhere] sm:text-xl"
              >
                {business.name}
              </h2>
              {/* Preserve the current BusinessWorkspace badge for the authorized active workspace. */}
              <Badge className="shrink-0 gap-1 bg-primary/10 px-2 py-0.5 text-[0.6875rem] leading-4 text-primary">
                <Check className="size-3" aria-hidden="true" />
                Active
              </Badge>
            </div>
            {business.category ? (
              <p className="mt-2 flex items-start gap-1.5 text-[0.8125rem] leading-5 text-muted-foreground">
                <Building2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {business.category}
                </span>
              </p>
            ) : null}
            {validCreatedAt ? (
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Created{" "}
                <time dateTime={validCreatedAt.toISOString()}>
                  {validCreatedAt.toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </p>
            ) : null}
          </div>
          {/* The existing editor and owner authorization remain authoritative. */}
          <Button
            asChild={isOwner}
            variant="secondary"
            size="sm"
            disabled={!isOwner}
            className="col-start-2 row-start-2 w-fit gap-1.5 px-2.5 text-base font-normal disabled:opacity-100 min-[375px]:col-start-3 min-[375px]:row-start-1"
          >
            {isOwner ? (
              <Link href={"/business/edit?section=information" as Route}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </Link>
            ) : (
              <>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </>
            )}
          </Button>
        </Card>
      </section>

      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="space-y-2"
        >
          <h2
            id={`${group.id}-heading`}
            className="text-base font-semibold leading-6 text-muted-foreground"
          >
            {group.title}
          </h2>
          <Card className="px-3 sm:px-4">
            <ul className="divide-y divide-border">
              {group.rows.map((row) => (
                <ProfileSettingsRow key={row.title} {...row} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

export function MyProfileHubSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading business</span>
      <div aria-hidden="true" className="space-y-6">
        <Card className={summaryGrid}>
          <Skeleton className="row-span-2 size-16 rounded-lg min-[375px]:row-span-1 sm:size-20" />
          <div className="min-w-0 space-y-2 py-0.5">
            <Skeleton className="h-6 w-full max-w-44" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="col-start-2 h-9 w-16 min-[375px]:col-start-3" />
        </Card>
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Card className="divide-y divide-border px-3 sm:px-4">
              {group.rows.map((row) => (
                <div key={row.title} className="flex min-h-16 items-center gap-3 py-2.5">
                  <Skeleton className="size-9 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                  <Skeleton className="h-4 w-2 shrink-0" />
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
