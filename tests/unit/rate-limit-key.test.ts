import { describe, expect, it } from "vitest";
import {
  canonicalizeRateLimitParts,
  deriveRateLimitBucketKey,
  parseTrustedForwardedFor,
} from "@/lib/security/rate-limit-key";

describe("application rate-limit keys", () => {
  it("derives stable opaque buckets without retaining identity material", () => {
    const secret = "service-role-test-secret";
    const email = "person+tag@example.com";
    const first = deriveRateLimitBucketKey(secret, "auth_login_identity", [
      "email",
      email,
    ]);
    const second = deriveRateLimitBucketKey(secret, "auth_login_identity", [
      "email",
      email,
    ]);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(email);
    expect(
      deriveRateLimitBucketKey(secret, "auth_signup_identity", ["email", email]),
    ).not.toBe(first);
  });

  it("length-prefixes identity parts so delimiter-like input cannot collide", () => {
    expect(canonicalizeRateLimitParts(["ab", "c"])).not.toBe(
      canonicalizeRateLimitParts(["a", "bc"]),
    );
  });

  it("trusts only the first syntactically valid forwarded address", () => {
    expect(parseTrustedForwardedFor("203.0.113.4, 10.0.0.1")).toBe("203.0.113.4");
    expect(parseTrustedForwardedFor("2001:db8::1, 10.0.0.1")).toBe("2001:db8::1");
    expect(parseTrustedForwardedFor("not-an-ip, 203.0.113.4")).toBeNull();
    expect(parseTrustedForwardedFor(null)).toBeNull();
  });
});
