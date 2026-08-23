import {
  generateOpaqueToken,
  hashOpaqueToken,
  isPlausibleOpaqueToken,
} from "@/lib/security/tokens";

export const addonTokenBytes = 32;
export const addonTokenLifetimeHours = 24;

export function generateAddonToken() {
  return generateOpaqueToken(addonTokenBytes);
}

export function hashAddonToken(token: string) {
  return hashOpaqueToken(token);
}

export function isPlausibleAddonToken(token: string) {
  return isPlausibleOpaqueToken(token);
}

export function addonExpiresAt(now = new Date()) {
  return new Date(now.getTime() + addonTokenLifetimeHours * 60 * 60 * 1000);
}
