import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { Archive, ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/forms/customer-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { archiveCustomerAction, updateCustomerAction } from "@/features/customers/actions";
import { getCustomerForBusiness } from "@/features/customers/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const { customerId } = await params;
  const query = (await searchParams) ?? {};
  const customer = await getCustomerForBusiness(currentBusiness.id, customerId);

  if (!customer) {
    notFound();
  }

  const isArchived = Boolean(customer.archived_at);
  const duplicateWarning = query.duplicate === "1";
  const created = query.created === "1";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={"/customers" as Route}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Customers
            </Link>
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{customer.name}</h1>
            {isArchived ? <Badge variant="outline">Archived</Badge> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Created {formatDateTime(customer.created_at)}
          </p>
        </div>
        {!isArchived ? (
          <form action={archiveCustomerAction.bind(null, customer.id)}>
            <Button type="submit" variant="secondary" className="w-full sm:w-fit">
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </Button>
          </form>
        ) : null}
      </div>

      {created ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Customer created.
        </p>
      ) : null}

      {duplicateWarning ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          A customer with this phone or email may already exist. The record was saved
          because duplicate contact details are allowed.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            action={updateCustomerAction.bind(null, customer.id)}
            submitLabel="Save customer"
            disabled={isArchived}
            initialValues={{
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              notes: customer.notes,
            }}
          />
          {isArchived ? (
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Archived customers are read-only in Phase 4.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <EmptyState
        title="No booking history yet."
        description="Booking history will appear here once bookings are added in a later phase."
      />
    </main>
  );
}
