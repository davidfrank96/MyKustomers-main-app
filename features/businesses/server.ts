import "server-only";
import { getCurrentBusinessContext } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BusinessProfile =
  Database["public"]["Tables"]["businesses"]["Row"];

export type CurrentBusinessProfileResult =
  | { status: "none"; memberships: number }
  | {
      status: "found";
      business: BusinessProfile;
      role: Database["public"]["Enums"]["business_member_role"];
      memberships: number;
    };

export async function getCurrentBusinessProfile(): Promise<CurrentBusinessProfileResult> {
  const context = await getCurrentBusinessContext();

  if (!context.currentBusiness) {
    return { status: "none", memberships: context.memberships.length };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", context.currentBusiness.id)
    .maybeSingle();

  if (error || !data) {
    return { status: "none", memberships: context.memberships.length };
  }

  return {
    status: "found",
    business: data,
    role: context.currentBusiness.role,
    memberships: context.memberships.length,
  };
}
