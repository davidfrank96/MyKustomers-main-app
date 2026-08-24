import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import fs from "node:fs";

describe("Next.js request logging", () => {
  it("suppresses OAuth callback query strings without disabling ordinary logs", () => {
    const logging = nextConfig.logging;

    expect(logging).not.toBe(false);
    expect(logging).toBeTypeOf("object");

    const incomingRequests =
      typeof logging === "object" ? logging.incomingRequests : undefined;

    expect(incomingRequests).not.toBe(false);
    expect(incomingRequests).toBeTypeOf("object");

    const ignored =
      typeof incomingRequests === "object" ? incomingRequests.ignore : undefined;

    expect(
      ignored?.some((pattern) => pattern.test("/auth/callback?code=transient")),
    ).toBe(true);
    expect(ignored?.some((pattern) => pattern.test("/login"))).toBe(false);
  });
});

describe("private capability cache headers", () => {
  it("keeps every customer capability route non-cacheable and non-indexable", async () => {
    const headers = await nextConfig.headers?.();

    for (const prefix of ["/c", "/a", "/x", "/f"]) {
      const rule = headers?.find((candidate) => candidate.source === `${prefix}/:token*`);
      expect(rule?.headers).toEqual(
        expect.arrayContaining([
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ]),
      );
    }
  });

  it("preserves capability headers through the session proxy", () => {
    const proxy = fs.readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("(?:a|c|f|x)");
    expect(proxy).toContain(
      'response.headers.set("Cache-Control", "no-store, max-age=0")',
    );
  });
});
