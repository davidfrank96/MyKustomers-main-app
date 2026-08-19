import { createHash } from "node:crypto";

export function hashRateLimitIdentity(identity: string) {
  return createHash("sha256").update(identity, "utf8").digest("hex");
}
