import { createHmac, hkdfSync } from "node:crypto";
import { isIP } from "node:net";

const RATE_LIMIT_SALT = "mykustomers-rate-limit-v1";
const RATE_LIMIT_INFO = "application-bucket-key";

function encodePart(value: string) {
  return `${Buffer.byteLength(value, "utf8")}:${value}`;
}

export function canonicalizeRateLimitParts(parts: readonly string[]) {
  return parts.map(encodePart).join("");
}

export function deriveRateLimitBucketKey(
  secret: string,
  action: string,
  keyParts: readonly string[],
) {
  const derivedKey = hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(RATE_LIMIT_SALT, "utf8"),
    Buffer.from(RATE_LIMIT_INFO, "utf8"),
    32,
  );

  return createHmac("sha256", Buffer.from(derivedKey))
    .update(canonicalizeRateLimitParts([action, ...keyParts]), "utf8")
    .digest("hex");
}

export function parseTrustedForwardedFor(value: string | null | undefined) {
  const firstAddress = value?.split(",", 1)[0]?.trim();
  return firstAddress && isIP(firstAddress) !== 0 ? firstAddress : null;
}
