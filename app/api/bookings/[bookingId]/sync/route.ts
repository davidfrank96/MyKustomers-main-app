import { NextResponse } from "next/server";
import { z } from "zod";
import { createBookingLiveState } from "@/features/bookings/live-sync";
import { getAuthenticatedUser, getCurrentBusinessContext } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const bookingIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ bookingId: string }>;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return response({ status: "error", message: "Authentication is required." }, 401);
  }

  const parsedBookingId = bookingIdSchema.safeParse((await context.params).bookingId);
  const businessContext = await getCurrentBusinessContext(user);
  if (!parsedBookingId.success || !businessContext.currentBusiness) {
    return response({ status: "error", message: "Booking was not found." }, 404);
  }

  const supabase = await createClient();
  const businessId = businessContext.currentBusiness.id;
  const [{ data: booking }, { data: feedback }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, updated_at, customer_confirmed_at")
      .eq("id", parsedBookingId.data)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("feedback")
      .select("submitted_at")
      .eq("booking_id", parsedBookingId.data)
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  if (!booking) {
    return response({ status: "error", message: "Booking was not found." }, 404);
  }

  return response(
    createBookingLiveState({
      status: booking.status,
      updatedAt: booking.updated_at,
      customerConfirmedAt: booking.customer_confirmed_at,
      feedbackSubmittedAt: feedback?.submitted_at ?? null,
    }),
  );
}
