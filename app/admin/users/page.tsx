import { Users } from "lucide-react";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatAuthProvider,
  parseAdminDirectoryParams,
} from "@/features/admin/directory";
import { listAdminUsers } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Users | Platform administration" };

type AdminUsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
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

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = parseAdminDirectoryParams((await searchParams) ?? {});
  const result = await listAdminUsers(params);

  return (
    <section aria-labelledby="admin-users-title" className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform Support</p>
        <h1 id="admin-users-title" className="mt-2 text-3xl font-semibold">
          Users
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Read-only account identity, authentication methods, and business relationships.
        </p>
      </header>

      <DebouncedSearchInput
        clearLabel="Clear user search"
        initialValue={params.q}
        label="Search users"
        placeholder="Search display name or account email"
      />

      {result.items.length === 0 ? (
        <EmptyState
          title={params.q ? `No users match "${params.q}".` : "No users found."}
          description="Try a different account identity search."
        />
      ) : (
        <div className="space-y-3" data-admin-directory="users">
          {result.items.map((user) => {
            const displayName = user.display_name ?? "Profile unavailable";
            const identity = user.display_name ?? user.email ?? user.id;

            return (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}` as Route}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <Avatar>
                    <AvatarFallback>{initials(identity)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold">{displayName}</h2>
                        <p className="mt-1 break-all text-sm text-muted-foreground">
                          {user.email ?? "Email unavailable"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-muted-foreground">
                        Created {dateFormatter.format(new Date(user.created_at))}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {user.providers.length > 0 ? (
                        user.providers.map((provider) => (
                          <Badge key={provider} variant="outline">
                            {formatAuthProvider(provider)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">Provider unavailable</Badge>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="size-4" aria-hidden="true" />
                        {user.membership_count} business memberships
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AdminPagination
        basePath="/admin/users"
        page={result.page}
        q={params.q}
        total={result.total}
        totalPages={result.totalPages}
      />
    </section>
  );
}
