import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { ChevronRight, Plus } from "lucide-react";
import {
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentBusinessContext } from "@/lib/auth/server";
import { listCustomersForBusiness } from "@/features/customers/queries";
import {
  parseCustomerListParams,
  type CustomerArchiveFilter,
} from "@/features/customers/validation";

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function filterHref(status: CustomerArchiveFilter, q: string) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (q) {
    params.set("q", q);
  }
  return `/customers?${params.toString()}` as Route;
}

function pageHref({
  status,
  q,
  page,
}: {
  status: CustomerArchiveFilter;
  q: string;
  page: number;
}) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("page", String(page));
  if (q) {
    params.set("q", q);
  }
  return `/customers?${params.toString()}` as Route;
}

function CustomerRowsFallback() {
  return (
    <Card className="divide-y divide-border overflow-hidden" role="status" aria-label="Loading customer rows">
      <span className="sr-only">Loading customer rows</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="p-4"
          aria-hidden
        >
          <Skeleton className="h-5 w-full max-w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-xs" />
        </div>
      ))}
    </Card>
  );
}

async function CustomerResults({
  resultPromise,
  params,
}: {
  resultPromise: ReturnType<typeof listCustomersForBusiness>;
  params: ReturnType<typeof parseCustomerListParams>;
}) {
  const result = await resultPromise;

  return (
    <>
      {result.customers.length === 0 ? (
        <EmptyState
          title={
            params.q
              ? "No matching customers."
              : params.status === "archived"
                ? "No archived customers."
                : "No customers yet."
          }
          description={
            params.q
              ? "No saved customers matched this search."
              : "Add your first customer to start building a business-owned customer list."
          }
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {result.customers.map((customer) => {
            const contact = customer.phone || customer.email || "No contact saved";
            const initial = customer.name.trim().charAt(0).toUpperCase() || "C";

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}` as Route}
                className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-muted/60 sm:px-5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-primary">
                  {initial}
                </span>
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold leading-5 sm:text-base">
                        {customer.name}
                      </h2>
                      {customer.archived_at ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">
                      {contact}
                    </p>
                  </div>
                  <p className="mt-1 shrink-0 text-xs text-muted-foreground sm:mt-0 sm:text-sm">
                    Customer since {formatDate(customer.created_at)}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {result.customers.length} of {result.total} customers.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="secondary" size="sm" disabled={result.page <= 1}>
            <Link
              href={pageHref({
                status: params.status,
                q: params.q,
                page: result.page - 1,
              })}
            >
              Previous
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            size="sm"
            disabled={result.page >= result.totalPages}
          >
            <Link
              href={pageHref({
                status: params.status,
                q: params.q,
                page: result.page + 1,
              })}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const params = parseCustomerListParams((await searchParams) ?? {});
  const resultPromise = listCustomersForBusiness(currentBusiness.id, params);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Customers"
        description={`Contact details and private notes for ${currentBusiness.name}.`}
        eyebrow={<Badge variant="outline">Customer records</Badge>}
        action={
          <Button asChild size="sm">
            <Link href={"/customers/new" as Route}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">Add customer</span>
              <span className="min-[360px]:hidden">Add</span>
            </Link>
          </Button>
        }
      />

      <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <DebouncedSearchInput
              clearLabel="Clear customer search"
              initialValue={params.q}
              placeholder="Search name, email, or phone"
              label="Search customers"
            />

            <div className="flex flex-wrap gap-2" aria-label="Customer archive filters">
              {(["active", "archived", "all"] as const).map((status) => (
                <Button
                  key={status}
                  asChild
                  variant={params.status === status ? "primary" : "secondary"}
                  size="sm"
                >
                  <Link href={filterHref(status, params.q)}>
                    {status[0].toUpperCase()}
                    {status.slice(1)}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
      </Card>

      <Suspense fallback={<CustomerRowsFallback />}>
        <CustomerResults resultPromise={resultPromise} params={params} />
      </Suspense>
    </WorkspacePage>
  );
}
