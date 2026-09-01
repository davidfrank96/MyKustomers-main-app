import "server-only";
import { cookies } from "next/headers";

const PASSWORD_RECOVERY_COOKIE_NAME = "mc_password_recovery";
const passwordRecoveryLifetimeSeconds = 60 * 10;

export async function setPasswordRecoveryIntent() {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE_NAME, "1", {
    httpOnly: true,
    maxAge: passwordRecoveryLifetimeSeconds,
    path: "/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function hasPasswordRecoveryIntent() {
  const cookieStore = await cookies();
  return cookieStore.get(PASSWORD_RECOVERY_COOKIE_NAME)?.value === "1";
}

export async function clearPasswordRecoveryIntent() {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
