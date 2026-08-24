import "server-only";
import { canUseServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  isFeedbackShareMethod,
  type FeedbackShareMethod,
} from "@/features/feedback/share";

export type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
export type FeedbackLink = Database["public"]["Tables"]["feedback_links"]["Row"];
export type BookingIssue = Database["public"]["Tables"]["booking_issues"]["Row"];

export type FeedbackLinkSummary = {
  id: string;
  status: "none" | "active" | "expired" | "revoked" | "submitted";
  createdAt: string | null;
  expiresAt: string | null;
  submittedAt: string | null;
  firstOpenedAt: string | null;
  sharedAt: string | null;
  shareMethod: FeedbackShareMethod | null;
};

export type FeedbackWithBooking = Feedback & {
  booking: {
    id: string;
    reference: string;
    title: string;
  } | null;
};

type FeedbackRowWithBooking = Feedback & {
  bookings: FeedbackWithBooking["booking"];
};

export async function getFeedbackLinkSummaryForBooking(
  businessId: string,
  bookingId: string,
): Promise<FeedbackLinkSummary> {
  if (!canUseServiceRoleClient()) {
    return {
      id: "",
      status: "none",
      createdAt: null,
      expiresAt: null,
      submittedAt: null,
      firstOpenedAt: null,
      sharedAt: null,
      shareMethod: null,
    };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("feedback_links")
    .select("id, created_at, expires_at, used_at, revoked_at, first_opened_at")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      id: "",
      status: "none",
      createdAt: null,
      expiresAt: null,
      submittedAt: null,
      firstOpenedAt: null,
      sharedAt: null,
      shareMethod: null,
    };
  }

  const { data: shareEvent } = await supabase
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("business_id", businessId)
    .eq("event_type", "FEEDBACK_SHARE_INITIATED")
    .contains("metadata", { feedback_link_id: data.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shareMethod =
    shareEvent?.metadata &&
    typeof shareEvent.metadata === "object" &&
    !Array.isArray(shareEvent.metadata) &&
    "method" in shareEvent.metadata
      ? shareEvent.metadata.method
      : null;

  const status = data.used_at
    ? "submitted"
    : data.revoked_at
      ? "revoked"
      : new Date(data.expires_at).getTime() <= Date.now()
        ? "expired"
        : "active";

  return {
    id: data.id,
    status,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    submittedAt: data.used_at,
    firstOpenedAt: data.first_opened_at,
    sharedAt: shareEvent?.created_at ?? null,
    shareMethod: isFeedbackShareMethod(shareMethod) ? shareMethod : null,
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
    .select("*, bookings!feedback_booking_business_fk(id, reference, title)")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("submitted_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return (data as unknown as FeedbackRowWithBooking[]).map(
    ({ bookings, ...feedback }) => ({
      ...feedback,
      booking: bookings,
    }),
  );
}

export async function listBookingIssuesForBooking(businessId: string, bookingId: string) {
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
