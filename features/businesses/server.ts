import "server-only";
import {
  getCurrentBusinessContext,
  type BusinessSummary,
} from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BusinessProfile =
  Database["public"]["Tables"]["businesses"]["Row"];

export type CurrentBusinessProfileResult =
  | { status: "none"; memberships: number; businesses: BusinessSummary[] }
  | {
      status: "found";
      business: BusinessProfile;
      role: Database["public"]["Enums"]["business_member_role"];
      memberships: number;
      businesses: BusinessSummary[];
    };

export async function getCurrentBusinessProfile(): Promise<CurrentBusinessProfileResult> {
  const context = await getCurrentBusinessContext();

  if (!context.currentBusiness) {
    return {
      status: "none",
      memberships: context.memberships.length,
      businesses: context.businesses,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", context.currentBusiness.id)
    .maybeSingle();

  if (error || !data) {
    return {
      status: "none",
      memberships: context.memberships.length,
      businesses: context.businesses,
    };
  }

  return {
    status: "found",
    business: data,
    role: context.currentBusiness.role,
    memberships: context.memberships.length,
    businesses: context.businesses,
  };
}
