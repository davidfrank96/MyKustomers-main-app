import "server-only";
import { cache } from "react";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { isSupabasePublicEnvConfigured } from "@/lib/config/public-env";
import { getSelectedBusinessId } from "@/lib/auth/current-business";
import { resolveCurrentBusinessId } from "@/lib/auth/current-business-selection";
import { getSafeRedirectPath } from "@/lib/security/redirects";
import { createClient } from "@/lib/supabase/server";
import type { BusinessMemberRole } from "@/types/database";
import { isBusinessOnboardingPending } from "@/features/businesses/onboarding";

export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

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
  onboardingPending: boolean;
};

export type BusinessContext = {
  memberships: BusinessMembership[];
  businesses: BusinessSummary[];
  pendingBusinesses: BusinessSummary[];
  currentBusiness: BusinessSummary | null;
};

type BusinessAccessRow = {
  business_id: string;
  role: BusinessMemberRole;
  status: "active";
  businesses: {
    id: string;
    name: string;
    slug: string;
    category: string;
    logo_path: string | null;
    onboarding_completed_at: string;
  } | null;
};

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const getVerifiedAuthClaims = cache(async function getVerifiedAuthClaims() {
  if (!isSupabasePublicEnvConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  return error || !data?.claims?.sub ? null : data.claims;
});

export const getAuthenticatedUser = cache(
  async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    if (!isSupabasePublicEnvConfigured()) {
      return null;
    }

    const claims = await getVerifiedAuthClaims();

    if (!claims) {
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
  },
);

export const getAuthenticatedAssuranceLevel = cache(
  async function getAuthenticatedAssuranceLevel(): Promise<AuthenticatorAssuranceLevel | null> {
    const claims = await getVerifiedAuthClaims();

    if (!claims) return null;
    return claims.aal === "aal2" ? "aal2" : "aal1";
  },
);

export async function requireUser(next = "/dashboard") {
  const user = await getAuthenticatedUser();

  if (!user) {
    const safeNext = encodeURIComponent(getSafeRedirectPath(next));
    redirect(`/login?next=${safeNext}` as Route);
  }

  return user;
}

export const getBusinessMemberships = cache(async function getBusinessMemberships(
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
});

export const getCurrentBusinessContext = cache(async function getCurrentBusinessContext(
  authenticatedUser?: AuthenticatedUser,
): Promise<BusinessContext> {
  const user = authenticatedUser ?? (await getAuthenticatedUser());

  if (!user || !isSupabasePublicEnvConfigured()) {
    return {
      memberships: [],
      businesses: [],
      pendingBusinesses: [],
      currentBusiness: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select(
      "business_id, role, status, businesses!business_members_business_id_fkey(id, name, slug, category, logo_path, onboarding_completed_at)",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("business_id", { ascending: true });

  if (error || !data) {
    return {
      memberships: [],
      businesses: [],
      pendingBusinesses: [],
      currentBusiness: null,
    };
  }

  const rows = data as unknown as BusinessAccessRow[];
  const memberships = rows.map((row) => ({
    businessId: row.business_id,
    role: row.role,
    status: row.status,
  }));
  const allBusinesses = rows.flatMap((row) => {
    const business = row.businesses;

    return business
      ? [
          {
            id: business.id,
            name: business.name,
            slug: business.slug,
            category: business.category,
            logoPath: business.logo_path,
            role: row.role,
            onboardingPending: isBusinessOnboardingPending(
              business.onboarding_completed_at,
            ),
          } satisfies BusinessSummary,
        ]
      : [];
  });
  const pendingBusinesses = allBusinesses.filter(
    (business) => business.onboardingPending,
  );
  const pendingIds = new Set(pendingBusinesses.map((business) => business.id));
  const businesses = allBusinesses.filter((business) => !pendingIds.has(business.id));
  const selectedBusinessId = resolveCurrentBusinessId(
    businesses,
    await getSelectedBusinessId(),
  );
  const currentBusiness =
    businesses.find((business) => business.id === selectedBusinessId) ?? null;

  return {
    memberships,
    businesses,
    pendingBusinesses,
    currentBusiness,
  };
});

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
  const [user, context] = await Promise.all([
    requireUser(next),
    getCurrentBusinessContext(),
  ]);

  if (!context.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return { user, business: context.currentBusiness };
}
