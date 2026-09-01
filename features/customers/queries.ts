import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  escapePostgrestLikePattern,
  quotePostgrestFilterValue,
} from "@/lib/supabase/filters";
import type { Database } from "@/types/database";
import type { CustomerListParams } from "@/features/customers/validation";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerListItem = Pick<
  Customer,
  "id" | "name" | "email" | "phone" | "archived_at" | "created_at"
> & { hasBookings?: boolean };

export type CustomerListResult = {
  customers: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CustomerListCursor = {
  createdAt: string;
  id: string;
};

export type PotentialDuplicateCustomer = Pick<
  Customer,
  "id" | "name" | "email" | "phone"
>;

export async function listCustomersForBusiness(
  businessId: string,
  params: CustomerListParams,
  cursor?: CustomerListCursor,
): Promise<CustomerListResult> {
  const supabase = await createClient();
  const from = cursor ? 0 : (params.page - 1) * params.limit;
  const to = from + params.limit - 1;

  let query = supabase
    .from("customers")
    .select("id, name, email, phone, archived_at, created_at", { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (cursor) {
    const createdAt = quotePostgrestFilterValue(cursor.createdAt);
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${cursor.id})`,
    );
  }

  if (params.status === "active") {
    query = query.is("archived_at", null);
  } else if (params.status === "archived") {
    query = query.not("archived_at", "is", null);
  }

  if (params.q) {
    const escapedSearch = escapePostgrestLikePattern(params.q);
    if (escapedSearch) {
      const pattern = quotePostgrestFilterValue(`%${escapedSearch}%`);
      query = query.or(
        `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
      );
    }
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return {
      customers: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 1,
    };
  }

  const rows = data ?? [];
  const customerIds = rows.map((customer) => customer.id);
  const { data: bookingRows, error: bookingLookupError } = customerIds.length
    ? await supabase
        .from("bookings")
        .select("customer_id")
        .eq("business_id", businessId)
        .in("customer_id", customerIds)
    : { data: [], error: null };
  const customersWithBookings = new Set(
    (bookingRows ?? []).map((booking) => booking.customer_id),
  );
  const total = count ?? 0;
  return {
    customers: rows.map((customer) => ({
      ...customer,
      hasBookings: bookingLookupError !== null || customersWithBookings.has(customer.id),
    })),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getCustomerBookingState(businessId: string, customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("status")
    .eq("business_id", businessId)
    .eq("customer_id", customerId);

  if (error) {
    return { hasBookings: true, hasActiveBookings: true };
  }

  const bookingRows = data ?? [];
  const terminalStatuses = new Set(["COMPLETED", "CANCELLED"]);
  return {
    hasBookings: bookingRows.length > 0,
    hasActiveBookings: bookingRows.some(
      (booking) => !terminalStatuses.has(booking.status),
    ),
  };
}

export async function countActiveCustomersForBusiness(businessId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("archived_at", null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getCustomerForBusiness(businessId: string, customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function hasPossibleDuplicateCustomer({
  businessId,
  email,
  phone,
  excludeCustomerId,
}: {
  businessId: string;
  email?: string;
  phone?: string;
  excludeCustomerId?: string;
}) {
  if (!email && !phone) {
    return false;
  }

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .limit(1);

  if (excludeCustomerId) {
    query = query.neq("id", excludeCustomerId);
  }

  const clauses = [
    email ? `email.eq.${quotePostgrestFilterValue(email)}` : null,
    phone ? `phone.eq.${quotePostgrestFilterValue(phone)}` : null,
  ].filter(Boolean);

  const { data, error } = await query.or(clauses.join(","));

  if (error) {
    return false;
  }

  return Boolean(data?.length);
}

export async function findPotentialDuplicateCustomers({
  businessId,
  name,
  email,
  phone,
}: {
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
}): Promise<PotentialDuplicateCustomer[]> {
  const clauses = [
    `name.ilike.${quotePostgrestFilterValue(escapePostgrestLikePattern(name))}`,
    email
      ? `email.ilike.${quotePostgrestFilterValue(escapePostgrestLikePattern(email))}`
      : null,
    phone ? `phone.eq.${quotePostgrestFilterValue(phone)}` : null,
  ].filter((clause): clause is string => Boolean(clause));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("business_id", businessId)
    .is("archived_at", null)
    .or(clauses.join(","))
    .order("name", { ascending: true })
    .limit(5);

  if (error || !data) {
    return [];
  }

  return data;
}
