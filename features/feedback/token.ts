import { createHash, randomBytes } from "node:crypto";

export const feedbackTokenBytes = 32;
export const feedbackTokenLifetimeDays = 14;

export function generateFeedbackToken() {
  return randomBytes(feedbackTokenBytes).toString("base64url");
}

export function hashFeedbackToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleFeedbackToken(token: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token);
}

export function feedbackLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + feedbackTokenLifetimeDays * 24 * 60 * 60 * 1000);
}
