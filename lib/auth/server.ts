import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getSelectedBusinessId } from "@/lib/auth/current-business";
import { resolveCurrentBusinessId } from "@/lib/auth/current-business-selection";
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
  logoPath: string | null;
  role: BusinessMemberRole;
};

export type BusinessContext = {
  memberships: BusinessMembership[];
  businesses: BusinessSummary[];
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
    .order("created_at", { ascending: true })
    .order("business_id", { ascending: true });

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
    return { memberships, businesses: [], currentBusiness: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug, category, logo_path")
    .in(
      "id",
      memberships.map((membership) => membership.businessId),
    );

  if (error || !data) {
    return { memberships, businesses: [], currentBusiness: null };
  }

  const businessById = new Map(data.map((business) => [business.id, business]));
  const businesses = memberships.flatMap((membership) => {
    const business = businessById.get(membership.businessId);

    return business
      ? [
          {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logoPath: business.logo_path,
            role: membership.role,
          } satisfies BusinessSummary,
        ]
      : [];
  });
  const selectedBusinessId = resolveCurrentBusinessId(
    businesses,
    await getSelectedBusinessId(),
  );
  const currentBusiness =
    businesses.find((business) => business.id === selectedBusinessId) ?? null;

  return {
    memberships,
    businesses,
    currentBusiness,
  };
}

export async function requireBusinessMembership(businessId?: string) {
  const context = await getCurrentBusinessContext();
  const memberships = context.memberships;

  if (memberships.length === 0) {
    throw new AuthorizationError("No active business membership was found.");
  }

  const membership = businessId
    ? memberships.find((candidate) => candidate.businessId === businessId)
    : memberships.find(
        (candidate) => candidate.businessId === context.currentBusiness?.id,
      );

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
