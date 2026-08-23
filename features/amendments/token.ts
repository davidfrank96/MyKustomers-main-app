import {
  generateOpaqueToken,
  hashOpaqueToken,
  isPlausibleOpaqueToken,
} from "@/lib/security/tokens";

export const amendmentTokenLifetimeHours = 24;

export function generateAmendmentToken() {
  return generateOpaqueToken(32);
}

export function hashAmendmentToken(token: string) {
  return hashOpaqueToken(token);
}

export function isPlausibleAmendmentToken(token: string) {
  return isPlausibleOpaqueToken(token);
}

export function amendmentExpiresAt(now = new Date()) {
  return new Date(now.getTime() + amendmentTokenLifetimeHours * 60 * 60 * 1000);
}
