import { hashOpaqueToken } from "@/lib/security/tokens";

export function hashRateLimitIdentity(identity: string) {
  return hashOpaqueToken(identity);
}
