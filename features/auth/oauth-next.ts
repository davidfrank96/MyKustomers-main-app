import "server-only";
import { cookies } from "next/headers";
import { getSafeOAuthNextPath } from "@/features/auth/oauth";

const OAUTH_NEXT_COOKIE_NAME = "mc_oauth_next";
const oauthStartLifetimeSeconds = 60 * 10;

export async function setOAuthNextPath(
  next: FormDataEntryValue | string | null | undefined,
) {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_NEXT_COOKIE_NAME, getSafeOAuthNextPath(next), {
    httpOnly: true,
    maxAge: oauthStartLifetimeSeconds,
    path: "/auth/callback",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function consumeOAuthNextPath() {
  const cookieStore = await cookies();
  const value = cookieStore.get(OAUTH_NEXT_COOKIE_NAME)?.value;

  cookieStore.set(OAUTH_NEXT_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/auth/callback",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return value ? getSafeOAuthNextPath(value) : null;
}
