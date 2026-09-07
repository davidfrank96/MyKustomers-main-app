import type { Route } from "next";
import { redirect } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { CustomerForm } from "@/components/forms/customer-form";
import {
  WorkspaceBackLink,
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
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
        <WorkspaceBackLink href={"/customers" as Route}>Customers</WorkspaceBackLink>
        <WorkspacePageHeader
          className="mt-3"
          title="Add customer"
          description="Save the basic contact details you already know. Email and phone are optional."
          action={
            <span
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary sm:size-12"
              aria-hidden="true"
            >
              <UserRoundPlus className="size-6" aria-hidden="true" />
            </span>
          }
        />
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
