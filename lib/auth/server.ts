import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { createClient } from "@/lib/supabase/server";
import type { BusinessMemberRole } from "@/types/database";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  userMetadata: Record<string, unknown>;
};

export type BusinessMembership = {
  businessId: string;
  role: BusinessMemberRole;
  status: "active";
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  category: string;
  role: BusinessMemberRole;
};

export type BusinessContext = {
  memberships: BusinessMembership[];
  currentBusiness: BusinessSummary | null;
};

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabasePublicEnvConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    return null;
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    userMetadata:
      typeof claims.user_metadata === "object" && claims.user_metadata !== null
        ? claims.user_metadata
        : {},
  };
}

export async function requireUser(next = "/dashboard") {
  const user = await getAuthenticatedUser();

  if (!user) {
    const safeNext = encodeURIComponent(getSafeRedirectPath(next));
    redirect(`/login?next=${safeNext}` as Route);
  }

  return user;
}

export async function getBusinessMemberships(
  authenticatedUser?: AuthenticatedUser,
): Promise<BusinessMembership[]> {
  const user = authenticatedUser ?? (await getAuthenticatedUser());

  if (!user || !isSupabasePublicEnvConfigured()) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((membership) => ({
    businessId: membership.business_id,
    role: membership.role,
    status: membership.status,
  }));
}

export async function getCurrentBusinessContext(
  authenticatedUser?: AuthenticatedUser,
): Promise<BusinessContext> {
  const memberships = await getBusinessMemberships(authenticatedUser);

  if (memberships.length === 0 || !isSupabasePublicEnvConfigured()) {
    return { memberships, currentBusiness: null };
  }

  const supabase = await createClient();
  const selectedMembership = memberships[0];
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug, category")
    .eq("id", selectedMembership.businessId)
    .maybeSingle();

  if (error || !data) {
    return { memberships, currentBusiness: null };
  }

  return {
    memberships,
    currentBusiness: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      category: data.category,
      role: selectedMembership.role,
    },
  };
}

export async function requireBusinessMembership(businessId?: string) {
  const memberships = await getBusinessMemberships();

  if (memberships.length === 0) {
    throw new AuthorizationError("No active business membership was found.");
  }

  const membership = businessId
    ? memberships.find((candidate) => candidate.businessId === businessId)
    : memberships[0];

  if (!membership) {
    throw new AuthorizationError();
  }

  return membership;
}

export async function requireBusinessRole(
  businessId: string,
  allowedRoles: BusinessMemberRole[],
  authenticatedUser?: AuthenticatedUser,
) {
  const memberships = await getBusinessMemberships(authenticatedUser);
  const membership = memberships.find((candidate) => candidate.businessId === businessId);

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new AuthorizationError();
  }

  return membership;
}

export async function requireCurrentBusiness(next = "/dashboard") {
  const user = await requireUser(next);
  const context = await getCurrentBusinessContext(user);

  if (!context.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return { user, business: context.currentBusiness };
}
