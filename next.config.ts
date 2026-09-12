import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const privateRobotsHeader = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
} as const;

const privateRouteSources = [
  "/login",
  "/signup",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/auth/:path*",
  "/onboarding/:path*",
  "/dashboard/:path*",
  "/bookings/:path*",
  "/customers/:path*",
  "/insights/:path*",
  "/business/:path*",
  "/settings/:path*",
  "/notifications/:path*",
  "/admin/:path*",
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  logging: {
    incomingRequests: {
      ignore: [/\/auth\/callback(?:\?|$)/, /\/(?:c|a|x|f)\/[^/]+/],
    },
  },
  async headers() {
    const headers = [
      {
        source: "/social/confirmation/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          privateRobotsHeader,
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/api/notifications/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          privateRobotsHeader,
        ],
      },
      {
        source: "/c/:token*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      {
        source: "/f/:token*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      {
        source: "/a/:token*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      {
        source: "/x/:token*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      {
        source: "/admin/security/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      ...privateRouteSources.map((source) => ({
        source,
        headers: [privateRobotsHeader],
      })),
    ];

    if (process.env.VERCEL_ENV !== "production") {
      headers.push({
        source: "/:path*",
        headers: [privateRobotsHeader],
      });
    }

    return headers;
  },
};

const sentryNextConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "my-kustomers",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA,
  },
  webpack: {
    automaticVercelMonitors: false,
    treeshake: {
      removeDebugLogging: true,
      excludeReplayCompressionWorker: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
    reactComponentAnnotation: {
      enabled: false,
    },
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});

// Keep Sentry's trace identifier for App Router page-load correlation, but do
// not render the dynamic-sampling `baggage` value into public HTML. That value
// includes the request transaction name and can expose capability route
// parameters before event sanitizers run.
if (typeof sentryNextConfig !== "function" && sentryNextConfig.experimental) {
  sentryNextConfig.experimental.clientTraceMetadata =
    sentryNextConfig.experimental.clientTraceMetadata?.filter(
      (metadataName) => metadataName !== "baggage",
    );
}

export default sentryNextConfig;
