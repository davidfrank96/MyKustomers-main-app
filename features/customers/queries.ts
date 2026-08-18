import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { CustomerListParams } from "@/features/customers/validation";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];

export type CustomerListResult = {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function escapeLike(value: string) {
  return value.replace(/[(),]/g, " ").replace(/[%_]/g, "\\$&").trim();
}

export async function listCustomersForBusiness(
  businessId: string,
  params: CustomerListParams,
): Promise<CustomerListResult> {
  const supabase = await createClient();
  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (params.status === "active") {
    query = query.is("archived_at", null);
  } else if (params.status === "archived") {
    query = query.not("archived_at", "is", null);
  }

  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`;
    if (pattern !== "%%") {
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
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

  const total = count ?? 0;
  return {
    customers: data ?? [],
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
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
    email ? `email.eq.${email}` : null,
    phone ? `phone.eq.${phone}` : null,
  ].filter(Boolean);

  const { data, error } = await query.or(clauses.join(","));

  if (error) {
    return false;
  }

  return Boolean(data?.length);
}
