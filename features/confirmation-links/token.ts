import {
  generateOpaqueToken,
  hashOpaqueToken,
  isPlausibleOpaqueToken,
} from "@/lib/security/tokens";

export const confirmationTokenBytes = 32;
export const confirmationTokenLifetimeHours = 24;

export function generateConfirmationToken() {
  return generateOpaqueToken(confirmationTokenBytes);
}

export function hashConfirmationToken(token: string) {
  return hashOpaqueToken(token);
}

export function isPlausibleConfirmationToken(token: string) {
  return isPlausibleOpaqueToken(token);
}

export function confirmationLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + confirmationTokenLifetimeHours * 60 * 60 * 1000);
}
