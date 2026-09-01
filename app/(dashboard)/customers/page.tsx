import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { CustomerLoadMoreList } from "@/components/customers/customer-load-more-list";
import { CustomersMobileActions } from "@/components/customers/customers-mobile-actions";
import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
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

function filterHref(status: CustomerArchiveFilter, q: string) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (q) {
    params.set("q", q);
  }
  return `/customers?${params.toString()}` as Route;
}

function CustomerRowsFallback() {
  return (
    <Card
      className="divide-y divide-border overflow-hidden"
      role="status"
      aria-label="Loading customer rows"
    >
      <span className="sr-only">Loading customer rows</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="p-4" aria-hidden>
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
  businessId,
}: {
  resultPromise: ReturnType<typeof listCustomersForBusiness>;
  params: ReturnType<typeof parseCustomerListParams>;
  businessId: string;
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
        <CustomerLoadMoreList
          key={`${businessId}:${params.status}:${params.q}`}
          initialCustomers={result.customers}
          total={result.total}
          q={params.q}
          status={params.status}
        />
      )}
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
    <WorkspacePage className="pb-52 sm:pb-52 lg:pb-7">
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
        <CustomerResults
          resultPromise={resultPromise}
          params={params}
          businessId={currentBusiness.id}
        />
      </Suspense>
      <CustomersMobileActions />
    </WorkspacePage>
  );
}
