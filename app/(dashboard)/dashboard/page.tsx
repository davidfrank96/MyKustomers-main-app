import { redirect } from "next/navigation";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookingDashboardStats } from "@/features/bookings/queries";
import { countActiveCustomersForBusiness } from "@/features/customers/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

export default async function DashboardPage() {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }
  const [customerCount, bookingStats] = await Promise.all([
    countActiveCustomersForBusiness(currentBusiness.id),
    getBookingDashboardStats(currentBusiness.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Authenticated workspace</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your business workspace is ready. Customer, booking, analytics, and billing
            workflows are intentionally deferred to later phases.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{currentBusiness.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">
              Category: {currentBusiness.category}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Slug: {currentBusiness.slug}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Active customer records: {customerCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Open booking records: {bookingStats.activeBookings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Scheduled upcoming bookings: {bookingStats.upcomingBookings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Past scheduled open bookings: {bookingStats.overdueBookings}
            </p>
          </CardContent>
        </Card>
      </div>

      <EmptyState
        title="Customer confirmation is planned."
        description="Booking records are vendor-managed in Phase 5. Customer confirmation links, feedback, analytics, and payment processing are deferred."
      />
    </main>
  );
}
