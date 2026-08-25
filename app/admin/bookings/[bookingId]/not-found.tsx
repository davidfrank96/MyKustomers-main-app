import { CalendarX } from "lucide-react";
import Link from "next/link";

export default function AdminBookingNotFound() {
  return <section className="border border-border bg-card p-6"><CalendarX className="size-6 text-muted-foreground" aria-hidden="true" /><h1 className="mt-4 text-2xl font-semibold">Booking not found</h1><p className="mt-2 text-sm text-muted-foreground">This booking is unavailable or no longer exists.</p><Link href="/admin/bookings" className="mt-6 inline-flex font-medium text-primary">Return to bookings</Link></section>;
}
