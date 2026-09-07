import { redirect } from "next/navigation";
import type { Route } from "next";
import { BookingForm } from "@/components/forms/booking-form";
import {
  WorkspaceBackLink,
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
import { createBookingAction } from "@/features/bookings/actions";
import { listActiveBookingCustomerOptions } from "@/features/bookings/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

export default async function NewBookingPage() {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const customers = await listActiveBookingCustomerOptions(currentBusiness.id);

  return (
    <WorkspacePage className="max-w-3xl pb-28 lg:pb-8">
      <div>
        <WorkspaceBackLink href={"/bookings" as Route}>Bookings</WorkspaceBackLink>
        <WorkspacePageHeader
          className="mt-3"
          title="New booking"
          description="Record the agreed work, scheduled delivery date, and any deposit already agreed. This is not payment verification."
        />
      </div>

      <BookingForm
        action={createBookingAction}
        submitLabel="Create booking"
        customers={customers}
        defaultCustomerMode={customers.length === 0 ? "new" : "existing"}
        mode="create"
      />
    </WorkspacePage>
  );
}
