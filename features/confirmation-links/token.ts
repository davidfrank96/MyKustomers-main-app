import { createHash, randomBytes } from "node:crypto";

export const confirmationTokenBytes = 32;
export const confirmationTokenLifetimeHours = 24;

export function generateConfirmationToken() {
  return randomBytes(confirmationTokenBytes).toString("base64url");
}

export function hashConfirmationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleConfirmationToken(token: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token);
}

export function confirmationLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + confirmationTokenLifetimeHours * 60 * 60 * 1000);
}
