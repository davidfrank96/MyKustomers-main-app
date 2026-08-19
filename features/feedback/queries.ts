import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
export type FeedbackLink = Database["public"]["Tables"]["feedback_links"]["Row"];
export type BookingIssue = Database["public"]["Tables"]["booking_issues"]["Row"];

export type FeedbackLinkSummary = {
  status: "none" | "active" | "expired" | "revoked" | "submitted";
  createdAt: string | null;
  expiresAt: string | null;
  submittedAt: string | null;
};

export type FeedbackWithBooking = Feedback & {
  booking: {
    id: string;
    reference: string;
    title: string;
  } | null;
};

export async function getFeedbackLinkSummaryForBooking(
  businessId: string,
  bookingId: string,
): Promise<FeedbackLinkSummary> {
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("submitted_at")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (feedback) {
    return {
      status: "submitted",
      createdAt: null,
      expiresAt: null,
      submittedAt: feedback.submitted_at,
    };
  }

  const { data, error } = await supabase
    .from("feedback_links")
    .select("created_at, expires_at, used_at, revoked_at")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { status: "none", createdAt: null, expiresAt: null, submittedAt: null };
  }

  const status = data.used_at
    ? "submitted"
    : data.revoked_at
      ? "revoked"
      : new Date(data.expires_at).getTime() <= Date.now()
        ? "expired"
        : "active";

  return {
    status,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    submittedAt: data.used_at,
  };
}

export async function getFeedbackForBooking(businessId: string, bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function listFeedbackForCustomer(
  businessId: string,
  customerId: string,
): Promise<FeedbackWithBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("submitted_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  const bookingIds = data.map((row) => row.booking_id);

  if (bookingIds.length === 0) {
    return [];
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, reference, title")
    .eq("business_id", businessId)
    .in("id", bookingIds);

  const bookingMap = new Map((bookings ?? []).map((booking) => [booking.id, booking]));

  return data.map((row) => ({
    ...row,
    booking: bookingMap.get(row.booking_id) ?? null,
  }));
}

export async function listBookingIssuesForBooking(
  businessId: string,
  bookingId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_issues")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}
