import { createHash, randomBytes } from "node:crypto";

export function generateOpaqueToken(byteLength: number) {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleOpaqueToken(token: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token);
}
