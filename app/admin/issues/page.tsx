import type { Metadata, Route } from "next";
import Link from "next/link";
import { AdminFilterSelect } from "@/components/admin/admin-filter-select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  adminIssueCategories,
  adminIssueStatuses,
  formatOperationLabel,
  parseAdminIssueParams,
} from "@/features/admin/operations";
import { listAdminIssues } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Issues | Platform administration" };

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function AdminIssuesPage({ searchParams }: PageProps) {
  const params = parseAdminIssueParams((await searchParams) ?? {});
  const result = await listAdminIssues(params);

  return (
    <section aria-labelledby="admin-issues-title" className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">Platform Operations</p>
        <h1 id="admin-issues-title" className="mt-2 text-3xl font-semibold">
          Issues
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Read-only operational exceptions linked to their booking and business.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem_15rem] lg:items-end">
        <DebouncedSearchInput
          clearLabel="Clear issue search"
          initialValue={params.q}
          label="Search platform issues"
          placeholder="Search booking reference, business, or category"
        />
        <AdminFilterSelect
          label="Issue status"
          param="status"
          value={params.status}
          options={adminIssueStatuses.map((value) => ({
            value,
            label: formatOperationLabel(value),
          }))}
        />
        <AdminFilterSelect
          label="Issue category"
          param="category"
          value={params.category}
          options={adminIssueCategories.map((value) => ({
            value,
            label: formatOperationLabel(value),
          }))}
        />
      </div>

      {params.businessId ? (
        <p className="text-sm text-muted-foreground">
          Filtered to one business. <Link href="/admin/issues" className="font-medium text-primary">Clear business filter</Link>
        </p>
      ) : null}

      {result.items.length === 0 ? (
        <EmptyState
          title="No issues found."
          description="No issue records match the current search and filters."
        />
      ) : (
        <div className="divide-y divide-border border-y border-border" data-admin-directory="issues">
          {result.items.map((issue) => (
            <Link
              key={issue.id}
              href={`/admin/issues/${issue.id}` as Route}
              className="grid gap-3 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={issue.status === "OPEN" ? "accent" : "outline"}>
                    {formatOperationLabel(issue.status)}
                  </Badge>
                  <span className="text-sm font-medium">
                    {formatOperationLabel(issue.category)}
                  </span>
                </div>
                <h2 className="mt-2 break-words font-semibold">
                  {issue.booking.reference} · {issue.booking.title}
                </h2>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {issue.business.name}
                </p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <p>Created {dateTimeFormatter.format(new Date(issue.created_at))} UTC</p>
                <p className="mt-1">
                  {issue.resolved_at
                    ? `Resolved ${dateTimeFormatter.format(new Date(issue.resolved_at))} UTC`
                    : "Not resolved"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AdminPagination
        basePath="/admin/issues"
        page={result.page}
        q={params.q}
        total={result.total}
        totalPages={result.totalPages}
        preservedParams={{
          status: params.status === "all" ? undefined : params.status,
          category: params.category === "all" ? undefined : params.category,
          business: params.businessId,
        }}
      />
    </section>
  );
}
