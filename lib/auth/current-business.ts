import "server-only";
import { cookies } from "next/headers";
import { CURRENT_BUSINESS_COOKIE_NAME } from "@/lib/auth/current-business-selection";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function getSelectedBusinessId() {
  const cookieStore = await cookies();
  return cookieStore.get(CURRENT_BUSINESS_COOKIE_NAME)?.value ?? null;
}

export async function setSelectedBusinessId(businessId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_BUSINESS_COOKIE_NAME, businessId, {
    httpOnly: true,
    maxAge: oneYearInSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSelectedBusinessId() {
  const cookieStore = await cookies();
  cookieStore.delete(CURRENT_BUSINESS_COOKIE_NAME);
}
