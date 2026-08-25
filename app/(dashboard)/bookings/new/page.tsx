import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { BookingForm } from "@/components/forms/booking-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={"/bookings" as Route}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Bookings
          </Link>
        </Button>
        <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
          New booking
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Record the agreed work, scheduled delivery date, and any deposit already
          agreed. This is not payment verification.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking details</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingForm
            action={createBookingAction}
            submitLabel="Create booking"
            customers={customers}
            defaultCustomerMode={customers.length === 0 ? "new" : "existing"}
            mode="create"
          />
        </CardContent>
      </Card>
    </main>
  );
}
