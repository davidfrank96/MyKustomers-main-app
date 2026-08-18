import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { BookingForm } from "@/components/forms/booking-form";
import { BookingStatusForm } from "@/components/forms/booking-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  transitionBookingStatusAction,
  updateBookingAction,
} from "@/features/bookings/actions";
import { formatMoneyMinor, deriveBalanceMinor, minorUnitsToInput } from "@/features/bookings/money";
import {
  getBookingForBusiness,
  listBookingStatusHistoryForBusiness,
} from "@/features/bookings/queries";
import {
  getAllowedBookingTransitions,
  getBookingStatusLabel,
  getTransitionLabel,
  isBookingOverdue,
  isTerminalBookingStatus,
} from "@/features/bookings/status";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type BookingDetailPageProps = {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: BookingDetailPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const { bookingId } = await params;
  const query = (await searchParams) ?? {};
  const booking = await getBookingForBusiness(currentBusiness.id, bookingId);

  if (!booking) {
    notFound();
  }

  const history = await listBookingStatusHistoryForBusiness(currentBusiness.id, booking.id);
  const balance = deriveBalanceMinor(booking.total_amount_minor, booking.deposit_amount_minor);
  const overdue = isBookingOverdue({
    scheduledFor: booking.scheduled_for,
    status: booking.status,
  });
  const allowedTransitions = getAllowedBookingTransitions(booking.status);
  const locked = isTerminalBookingStatus(booking.status);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={"/bookings" as Route}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Bookings
            </Link>
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{booking.reference}</Badge>
            <Badge variant={overdue ? "accent" : "default"}>
              {overdue ? "Overdue" : getBookingStatusLabel(booking.status)}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
            {booking.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {booking.customer?.name ?? "Customer unavailable"} · Scheduled {formatDateTime(booking.scheduled_for)}
          </p>
        </div>

        {allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map((status) => (
              <BookingStatusForm
                key={status}
                action={transitionBookingStatusAction.bind(null, booking.id, status)}
                label={getTransitionLabel(status)}
                variant={status === "CANCELLED" ? "destructive" : "secondary"}
                confirmMessage={
                  status === "CANCELLED" || status === "COMPLETED"
                    ? `Confirm ${getBookingStatusLabel(status).toLowerCase()}?`
                    : undefined
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {query.created === "1" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Booking created.
        </p>
      ) : null}

      {query.message === "status-updated" ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Booking status updated.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Agreed total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatMoneyMinor(booking.total_amount_minor, booking.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deposit recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {formatMoneyMinor(booking.deposit_amount_minor, booking.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatMoneyMinor(balance, booking.currency)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{locked ? "Booking details" : "Edit booking"}</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingForm
            action={updateBookingAction.bind(null, booking.id)}
            submitLabel="Save booking"
            mode="edit"
            disabled={locked}
            initialValues={{
              title: booking.title,
              description: booking.description,
              currency: booking.currency,
              totalAmount: minorUnitsToInput(booking.total_amount_minor),
              depositAmount: minorUnitsToInput(booking.deposit_amount_minor),
              scheduledFor: booking.scheduled_for,
              internalNotes: booking.internal_notes,
            }}
          />
          {locked ? (
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Completed and cancelled bookings are locked in Phase 5.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status history recorded.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((event) => (
                <li key={event.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">
                    {event.from_status ? getBookingStatusLabel(event.from_status) : "Created"} to{" "}
                    {getBookingStatusLabel(event.to_status)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {formatDateTime(event.changed_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <EmptyState
        title="Customer confirmation is not active."
        description="Confirmation links, customer tokens, and feedback workflows are deferred to later phases."
      />
    </main>
  );
}
