import {
  generateOpaqueToken,
  hashOpaqueToken,
  isPlausibleOpaqueToken,
} from "@/lib/security/tokens";

export const feedbackTokenBytes = 32;
export const feedbackTokenLifetimeDays = 14;

export function generateFeedbackToken() {
  return generateOpaqueToken(feedbackTokenBytes);
}

export function hashFeedbackToken(token: string) {
  return hashOpaqueToken(token);
}

export function isPlausibleFeedbackToken(token: string) {
  return isPlausibleOpaqueToken(token);
}

export function feedbackLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + feedbackTokenLifetimeDays * 24 * 60 * 60 * 1000);
}
