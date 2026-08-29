import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { CustomerForm } from "@/components/forms/customer-form";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { createCustomerAction } from "@/features/customers/actions";
import { getCurrentBusinessContext } from "@/lib/auth/server";

export default async function NewCustomerPage() {
  const businessContext = await getCurrentBusinessContext();

  if (!businessContext.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return (
    <WorkspacePage className="max-w-3xl pb-28 sm:pb-28 lg:pb-8">
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
        <div className="mt-5 flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl font-semibold leading-tight sm:text-4xl">
              Add customer
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Save the basic contact details you already know. Email and phone are
              optional.
            </p>
          </div>
          <span
            className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary sm:size-16"
            aria-hidden="true"
          >
            <UserRoundPlus className="size-7 sm:size-8" aria-hidden="true" />
          </span>
        </div>
      </div>

      <CustomerForm
        action={createCustomerAction}
        submitLabel="Create customer"
        presentation="create"
        cancelHref={"/customers" as Route}
      />
    </WorkspacePage>
  );
}
