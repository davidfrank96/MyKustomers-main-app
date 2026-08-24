import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js request logging", () => {
  it("suppresses OAuth callback query strings without disabling ordinary logs", () => {
    const logging = nextConfig.logging;

    expect(logging).not.toBe(false);
    expect(logging).toBeTypeOf("object");

    const incomingRequests = typeof logging === "object"
      ? logging.incomingRequests
      : undefined;

    expect(incomingRequests).not.toBe(false);
    expect(incomingRequests).toBeTypeOf("object");

    const ignored = typeof incomingRequests === "object"
      ? incomingRequests.ignore
      : undefined;

    expect(ignored?.some((pattern) => pattern.test("/auth/callback?code=transient"))).toBe(true);
    expect(ignored?.some((pattern) => pattern.test("/login"))).toBe(false);
  });
});
