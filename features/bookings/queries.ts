import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  escapePostgrestLikePattern,
  quotePostgrestFilterValue,
} from "@/lib/supabase/filters";
import type { Database } from "@/types/database";
import type { BookingListParams } from "@/features/bookings/validation";
import type { BookingStatus } from "@/features/bookings/status";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingStatusHistory =
  Database["public"]["Tables"]["booking_status_history"]["Row"];
export type BookingChange = Database["public"]["Tables"]["booking_changes"]["Row"];

const bookingListColumns =
  "id, customer_id, reference, title, currency, total_amount_minor, deposit_amount_minor, scheduled_for, status, created_at" as const;

type BookingListItem = Pick<
  Booking,
  | "id"
  | "customer_id"
  | "reference"
  | "title"
  | "currency"
  | "total_amount_minor"
  | "deposit_amount_minor"
  | "scheduled_for"
  | "status"
  | "created_at"
>;

export type BookingCustomerSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type BookingWithCustomer = BookingListItem & {
  customer: BookingCustomerSummary | null;
};

export type BookingListResult = {
  bookings: BookingWithCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type BookingDashboardStats = {
  activeBookings: number;
  upcomingBookings: number;
  overdueBookings: number;
  dueTodayBookings: number;
  inProgressBookings: number;
  readyBookings: number;
  dueToday: BookingWithCustomer[];
  overdue: BookingWithCustomer[];
  inProgress: BookingWithCustomer[];
  ready: BookingWithCustomer[];
};

async function matchingCustomerIds(businessId: string, search: string) {
  if (!search) {
    return [];
  }

  const supabase = await createClient();
  const escapedSearch = escapePostgrestLikePattern(search);
  if (!escapedSearch) {
    return [];
  }

  const pattern = quotePostgrestFilterValue(`%${escapedSearch}%`);
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.id);
}

async function customersById(businessId: string, customerIds: string[]) {
  const uniqueCustomerIds = [...new Set(customerIds)];

  if (uniqueCustomerIds.length === 0) {
    return new Map<string, BookingCustomerSummary>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("business_id", businessId)
    .in("id", uniqueCustomerIds);

  if (error || !data) {
    return new Map<string, BookingCustomerSummary>();
  }

  return new Map(data.map((customer) => [customer.id, customer]));
}

function attachCustomers<T extends { customer_id: string }>(
  bookings: T[],
  customerMap: Map<string, BookingCustomerSummary>,
) {
  return bookings.map((booking) => ({
    ...booking,
    customer: customerMap.get(booking.customer_id) ?? null,
  }));
}

function todayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function listBookingsForBusiness(
  businessId: string,
  params: BookingListParams,
): Promise<BookingListResult> {
  const supabase = await createClient();
  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  const now = new Date().toISOString();

  let query = supabase
    .from("bookings")
    .select(bookingListColumns, { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (params.filter === "active") {
    query = query.not("status", "in", "(COMPLETED,CANCELLED)");
  } else if (params.filter === "today") {
    const range = todayRange();
    query = query
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", range.start)
      .lt("scheduled_for", range.end)
      .not("status", "in", "(COMPLETED,CANCELLED)");
  } else if (params.filter === "upcoming") {
    query = query
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", now)
      .not("status", "in", "(COMPLETED,CANCELLED)");
  } else if (params.filter === "overdue") {
    query = query
      .not("scheduled_for", "is", null)
      .lt("scheduled_for", now)
      .not("status", "in", "(DELIVERED,COMPLETED,CANCELLED)");
  } else if (params.filter !== "all") {
    query = query.eq("status", params.filter as BookingStatus);
  }

  if (params.q) {
    const pattern = quotePostgrestFilterValue(
      `%${escapePostgrestLikePattern(params.q)}%`,
    );
    const customerIds = await matchingCustomerIds(businessId, params.q);
    const searchParts = [`reference.ilike.${pattern}`, `title.ilike.${pattern}`];

    if (customerIds.length > 0) {
      searchParts.push(`customer_id.in.(${customerIds.join(",")})`);
    }

    query = query.or(searchParts.join(","));
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return {
      bookings: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 1,
    };
  }

  const total = count ?? 0;
  const bookings = data ?? [];
  const customerMap = await customersById(
    businessId,
    bookings.map((booking) => booking.customer_id),
  );

  return {
    bookings: attachCustomers(bookings, customerMap),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getBookingForBusiness(businessId: string, bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const customerMap = await customersById(businessId, [data.customer_id]);
  return attachCustomers([data], customerMap)[0] ?? null;
}

export async function listBookingStatusHistoryForBusiness(
  businessId: string,
  bookingId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_status_history")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("changed_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function listBookingChangesForBusiness(
  businessId: string,
  bookingId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_changes")
    .select("*")
    .eq("business_id", businessId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function listActiveBookingCustomerOptions(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(100);

  if (error || !data) {
    return [];
  }

  return data;
}

export async function customerBelongsToBusiness(businessId: string, customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function getBookingDashboardStats(businessId: string): Promise<BookingDashboardStats> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const range = todayRange();

  const [active, upcoming, overdue, dueToday, inProgress, ready] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .not("status", "in", "(COMPLETED,CANCELLED)"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", now)
      .not("status", "in", "(COMPLETED,CANCELLED)"),
    supabase
      .from("bookings")
      .select(bookingListColumns, { count: "exact" })
      .eq("business_id", businessId)
      .not("scheduled_for", "is", null)
      .lt("scheduled_for", now)
      .not("status", "in", "(DELIVERED,COMPLETED,CANCELLED)")
      .order("scheduled_for", { ascending: true })
      .limit(5),
    supabase
      .from("bookings")
      .select(bookingListColumns, { count: "exact" })
      .eq("business_id", businessId)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", range.start)
      .lt("scheduled_for", range.end)
      .not("status", "in", "(COMPLETED,CANCELLED)")
      .order("scheduled_for", { ascending: true })
      .limit(5),
    supabase
      .from("bookings")
      .select(bookingListColumns, { count: "exact" })
      .eq("business_id", businessId)
      .eq("status", "IN_PROGRESS")
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("bookings")
      .select(bookingListColumns, { count: "exact" })
      .eq("business_id", businessId)
      .eq("status", "READY")
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  function queueRows(result: typeof dueToday) {
    return result.error ? [] : result.data ?? [];
  }

  const dueTodayRows = queueRows(dueToday);
  const overdueRows = queueRows(overdue);
  const inProgressRows = queueRows(inProgress);
  const readyRows = queueRows(ready);
  const customerMap = await customersById(
    businessId,
    [...dueTodayRows, ...overdueRows, ...inProgressRows, ...readyRows].map(
      (booking) => booking.customer_id,
    ),
  );

  return {
    activeBookings: active.error ? 0 : active.count ?? 0,
    upcomingBookings: upcoming.error ? 0 : upcoming.count ?? 0,
    overdueBookings: overdue.error ? 0 : overdue.count ?? 0,
    dueTodayBookings: dueToday.error ? 0 : dueToday.count ?? 0,
    inProgressBookings: inProgress.error ? 0 : inProgress.count ?? 0,
    readyBookings: ready.error ? 0 : ready.count ?? 0,
    dueToday: attachCustomers(dueTodayRows, customerMap),
    overdue: attachCustomers(overdueRows, customerMap),
    inProgress: attachCustomers(inProgressRows, customerMap),
    ready: attachCustomers(readyRows, customerMap),
  };
}
