import "server-only";

import { cookies } from "next/headers";

const PENDING_BUSINESS_ONBOARDING_COOKIE = "my-customers-pending-business-onboarding";
const pendingSetupLifetimeSeconds = 60 * 60 * 24;

export async function getPendingBusinessOnboardingId() {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_BUSINESS_ONBOARDING_COOKIE)?.value ?? null;
}

export async function setPendingBusinessOnboardingId(businessId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_BUSINESS_ONBOARDING_COOKIE, businessId, {
    httpOnly: true,
    maxAge: pendingSetupLifetimeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearPendingBusinessOnboardingId() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_BUSINESS_ONBOARDING_COOKIE);
}
