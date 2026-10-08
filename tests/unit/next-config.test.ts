import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import fs from "node:fs";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { SOCIAL_PREVIEW_CRAWLER_PATTERN } from "@/features/confirmation-links/crawlers";

const originalVercelEnvironment = process.env.VERCEL_ENV;

it("blocks metadata for every read-only social crawler while retaining Next's default bots", () => {
  expect(nextConfig.htmlLimitedBots?.source).toContain(HTML_LIMITED_BOT_UA_RE.source);
  expect(nextConfig.htmlLimitedBots?.source).toContain(
    SOCIAL_PREVIEW_CRAWLER_PATTERN.source,
  );
  for (const userAgent of [
    "TelegramBot",
    "Apple-PubSub",
    "iMessage",
    "Facebot",
    "WhatsApp",
    "Slackbot",
    "Discordbot",
    "LinkedInBot",
    "Twitterbot",
    "Bingbot",
    "Chrome-Lighthouse",
  ]) {
    expect(nextConfig.htmlLimitedBots?.test(userAgent)).toBe(true);
  }
  expect(nextConfig.htmlLimitedBots?.test("Mozilla/5.0 Safari/605.1.15")).toBe(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalVercelEnvironment === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnvironment;
  }
});

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

describe("Sentry trace metadata privacy", () => {
  it("keeps trace correlation without rendering dynamic-sampling baggage", () => {
    expect(nextConfig.experimental?.clientTraceMetadata).toContain("sentry-trace");
    expect(nextConfig.experimental?.clientTraceMetadata).not.toContain("baggage");
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
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ]),
      );
    }
  });

  it("adds explicit noindex headers to auth and private workspace routes", async () => {
    const headers = await nextConfig.headers?.();

    for (const source of [
      "/login",
      "/onboarding/:path*",
      "/dashboard/:path*",
      "/admin/:path*",
    ]) {
      expect(
        headers?.find((candidate) => candidate.source === source)?.headers,
      ).toContainEqual({
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
      });
    }
  });

  it("adds a deployment-wide noindex header outside Production only", async () => {
    process.env.VERCEL_ENV = "preview";
    expect(
      (await nextConfig.headers?.())?.find((rule) => rule.source === "/:path*"),
    ).toMatchObject({
      headers: [
        {
          key: "X-Robots-Tag",
          value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
        },
      ],
    });

    process.env.VERCEL_ENV = "production";
    expect(
      (await nextConfig.headers?.())?.find((rule) => rule.source === "/:path*"),
    ).toBeUndefined();
  });

  it("preserves capability headers through the session proxy", () => {
    const proxy = fs.readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("(?:a|c|f|x)");
    expect(proxy).toContain(
      'response.headers.set("Cache-Control", "no-store, max-age=0")',
    );
  });

  it("keeps machine-authenticated provider callbacks outside session middleware", () => {
    const proxy = fs.readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("api/webhooks/");
  });
});

describe("deployment identity", () => {
  it("keeps the framework-injected identity authoritative", async () => {
    vi.stubEnv("NEXT_DEPLOYMENT_ID", "dpl_frameworkProvidedIdentity");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_otherDeploymentIdentity");
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.deploymentId).toBe("dpl_frameworkProvidedIdentity");
  });

  it("uses distinct Vercel deployments within custom-ID constraints even for the same commit", async () => {
    vi.stubEnv("NEXT_DEPLOYMENT_ID", undefined);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "1234567890abcdef1234567890abcdef12345678");
    const ids: string[] = [];
    for (const id of [
      "dpl_H4Yqg7aH4PmnPYzmGozyGYzADvp8",
      "dpl_AXd5Ta6sYBjnT1pjFzTE6FHBZtJH",
    ]) {
      vi.stubEnv("VERCEL_DEPLOYMENT_ID", id);
      vi.resetModules();
      const { default: config } = await import("../../next.config");
      expect(config.deploymentId).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
      expect(config.deploymentId).not.toMatch(/^dpl_/);
      ids.push(config.deploymentId!);
    }
    expect(new Set(ids).size).toBe(2);
  });

  it("leaves local builds unpinned without deployment metadata", async () => {
    vi.stubEnv("NEXT_DEPLOYMENT_ID", undefined);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", undefined);
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.deploymentId).toBeUndefined();
  });
});
