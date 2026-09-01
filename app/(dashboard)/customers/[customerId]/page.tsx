import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { CustomerLifecyclePanel } from "@/components/customers/customer-lifecycle-panel";
import { CustomerForm } from "@/components/forms/customer-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { updateCustomerAction } from "@/features/customers/actions";
import {
  getCustomerBookingState,
  getCustomerForBusiness,
} from "@/features/customers/queries";
import { listFeedbackForCustomer } from "@/features/feedback/queries";
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

function formatCreatedDateTime(value: string) {
  const createdAt = new Date(value);
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(createdAt);
  const time = new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(createdAt);

  return `${date} • ${time}`;
}

function CustomerFeedbackFallback() {
  return (
    <Card role="status" aria-label="Loading private feedback">
      <CardHeader>
        <CardTitle>Private feedback</CardTitle>
      </CardHeader>
      <CardContent aria-hidden>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
      </CardContent>
    </Card>
  );
}

async function CustomerFeedback({
  feedbackPromise,
}: {
  feedbackPromise: ReturnType<typeof listFeedbackForCustomer>;
}) {
  const feedback = await feedbackPromise;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Private feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {feedback.length === 0 ? (
          <EmptyState
            title="No feedback yet."
            description="Private feedback from completed bookings will appear here."
          />
        ) : (
          <ol className="space-y-3">
            {feedback.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {item.booking?.title ?? "Booking unavailable"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {item.overall_rating}/5 · On time: {item.on_time ? "Yes" : "No"} ·
                      Met expectations: {item.met_expectations ? "Yes" : "No"}
                    </p>
                    {item.comment ? (
                      <p className="mt-2 leading-6 text-muted-foreground">
                        {item.comment}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.submitted_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
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
  const customerPromise = getCustomerForBusiness(currentBusiness.id, customerId);
  const feedbackPromise = listFeedbackForCustomer(currentBusiness.id, customerId);
  const bookingStatePromise = getCustomerBookingState(currentBusiness.id, customerId);
  const [customer, bookingState] = await Promise.all([
    customerPromise,
    bookingStatePromise,
  ]);

  if (!customer) {
    notFound();
  }

  const isArchived = Boolean(customer.archived_at);
  const duplicateWarning = query.duplicate === "1";
  const created = query.created === "1";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-8 sm:py-8 lg:px-10">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 text-primary hover:text-primary"
        >
          <Link href={"/customers" as Route}>
            <ArrowLeft className="size-5" aria-hidden="true" />
            Customers
          </Link>
        </Button>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-3xl font-semibold leading-tight sm:text-4xl">
            {customer.name}
          </h1>
          {isArchived ? <Badge variant="outline">Archived</Badge> : null}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm leading-6 text-muted-foreground sm:text-base">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          <span>Created {formatCreatedDateTime(customer.created_at)}</span>
        </p>
      </div>

      <CustomerLifecyclePanel
        customerId={customer.id}
        customerName={customer.name}
        isArchived={isArchived}
        hasBookings={bookingState.hasBookings}
        hasActiveBookings={bookingState.hasActiveBookings}
        canDelete={currentBusiness.role === "owner"}
      />

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

      <CustomerForm
        action={updateCustomerAction.bind(null, customer.id)}
        submitLabel="Save customer"
        disabled={isArchived}
        presentation="detail"
        initialValues={{
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
        }}
      />

      <Suspense fallback={<CustomerFeedbackFallback />}>
        <CustomerFeedback feedbackPromise={feedbackPromise} />
      </Suspense>
    </main>
  );
}
