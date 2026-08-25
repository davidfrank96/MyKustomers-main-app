import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatAuthProvider } from "@/features/admin/directory";
import { getAdminUser } from "@/features/admin/queries";

export const metadata: Metadata = { title: "User support | Platform administration" };

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

const uuidSchema = z.string().uuid();
const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function initials(value: string) {
  return (
    value
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const parsedId = uuidSchema.safeParse((await params).userId);
  if (!parsedId.success) notFound();

  const user = await getAdminUser(parsedId.data);
  if (!user) notFound();

  const displayName = user.display_name ?? "Profile unavailable";
  const identity = user.display_name ?? user.email ?? user.id;

  return (
    <section aria-labelledby="admin-user-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Users
        </Link>
        <div className="mt-5 flex min-w-0 items-start gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-base">{initials(identity)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="admin-user-title" className="break-words text-3xl font-semibold">
                {displayName}
              </h1>
              {user.platform_admin ? (
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 size-3.5" aria-hidden="true" />
                  Platform administrator
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 break-all text-sm text-muted-foreground">
              {user.email ?? "Email unavailable"}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="user-account-title">
        <h2 id="user-account-title" className="text-lg font-semibold">
          Account
        </h2>
        <dl className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="mt-1 font-medium">
              {dateFormatter.format(new Date(user.created_at))}
            </dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Email confirmation</dt>
            <dd className="mt-1 font-medium">
              {user.email_confirmed_at ? "Confirmed" : "Not confirmed"}
            </dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-sm text-muted-foreground">Last sign-in</dt>
            <dd className="mt-1 font-medium">
              {user.last_sign_in_at
                ? `${dateTimeFormatter.format(new Date(user.last_sign_in_at))} UTC`
                : "No recorded sign-in"}
            </dd>
          </div>
          <div className="bg-card p-4 sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Authentication providers</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {user.providers.length > 0 ? (
                user.providers.map((provider) => (
                  <Badge key={provider} variant="outline">
                    {formatAuthProvider(provider)}
                  </Badge>
                ))
              ) : (
                <span className="font-medium">Provider unavailable</span>
              )}
            </dd>
          </div>
          {user.platform_admin ? (
            <div className="bg-card p-4">
              <dt className="text-sm text-muted-foreground">Platform authority</dt>
              <dd className="mt-1 font-medium">
                {user.platform_admin.role} / {user.platform_admin.status}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="user-memberships-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="user-memberships-title" className="text-lg font-semibold">
            Business memberships
          </h2>
          <p className="text-sm text-muted-foreground">
            {user.memberships.length} records
          </p>
        </div>
        {user.memberships.length === 0 ? (
          <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
            This user has no business memberships.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {user.memberships.map((membership) => (
              <Link
                key={membership.business_id}
                href={`/admin/businesses/${membership.business_id}` as Route}
                className="grid gap-3 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3"
              >
                <div className="min-w-0">
                  <h3 className="break-words font-medium">
                    {membership.business_name ?? "Business unavailable"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {membership.business_slug
                      ? `/${membership.business_slug}`
                      : "Identity unavailable"}
                  </p>
                </div>
                <Badge variant="outline">{membership.role.toUpperCase()}</Badge>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>{membership.status.toUpperCase()}</p>
                  <p className="mt-1">
                    Joined {dateFormatter.format(new Date(membership.created_at))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
