import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { DebouncedSearchInput } from "@/components/shared/debounced-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentBusinessContext } from "@/lib/auth/server";
import { listCustomersForBusiness } from "@/features/customers/queries";
import { parseCustomerListParams, type CustomerArchiveFilter } from "@/features/customers/validation";

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

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const params = parseCustomerListParams((await searchParams) ?? {});
  const result = await listCustomersForBusiness(currentBusiness.id, params);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <Badge variant="outline">Customer records</Badge>
          <div>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Customers</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage customer contact details and private notes for {currentBusiness.name}.
            </p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-fit">
          <Link href={"/customers/new" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            Add customer
          </Link>
        </Button>
      </section>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
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
        </CardContent>
      </Card>

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
        <div className="grid gap-3">
          {result.customers.map((customer) => {
            const contact = customer.phone || customer.email || "No contact saved";

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}` as Route}
                className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/70"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold leading-6">{customer.name}</h2>
                      {customer.archived_at ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{contact}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Customer since {formatDate(customer.created_at)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {result.customers.length} of {result.total} customers.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" disabled={result.page <= 1}>
            <Link href={pageHref({ status: params.status, q: params.q, page: result.page - 1 })}>
              Previous
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            size="sm"
            disabled={result.page >= result.totalPages}
          >
            <Link href={pageHref({ status: params.status, q: params.q, page: result.page + 1 })}>
              Next
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
