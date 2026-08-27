import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const clientConfig = read("instrumentation-client.ts");
const serverConfig = read("sentry.server.config.ts");
const buildConfig = read("next.config.ts");
const sanitizer = read("lib/observability/sentry.ts");
const globalError = read("app/global-error.tsx");
const envExample = read(".env.example");
const source = [
  clientConfig,
  serverConfig,
  buildConfig,
  sanitizer,
  globalError,
  envExample,
].join("\n");

describe("Sentry observability security boundary", () => {
  it("keeps telemetry disabled unless a deployment supplies a DSN", () => {
    expect(clientConfig).toContain("enabled: Boolean(dsn)");
    expect(serverConfig).toContain("enabled: Boolean(dsn)");
    expect(envExample).toContain("NEXT_PUBLIC_SENTRY_DSN=\n");
    expect(envExample).toContain("SENTRY_DSN=\n");
  });

  it("does not hardcode the project DSN or an auth token", () => {
    expect(source).not.toMatch(/ingest(?:\.[a-z]{2})?\.sentry\.io\/\d+/);
    expect(source).not.toMatch(/sntrys_[A-Za-z0-9_-]+/);
    expect(buildConfig).toContain("process.env.SENTRY_AUTH_TOKEN");
  });

  it("disables PII-prone collection and unsupported telemetry products", () => {
    expect(sanitizer).toContain("userInfo: false");
    expect(sanitizer).toContain("cookies: false");
    expect(sanitizer).toContain("request: false");
    expect(sanitizer).toContain("response: false");
    expect(sanitizer).toContain("httpBodies: []");
    expect(sanitizer).toContain("urlQueryParams: false");
    expect(sanitizer).toContain("stackFrameVariables: false");
    expect(clientConfig).toContain("enableLogs: false");
    expect(clientConfig).toContain("enableMetrics: false");
    expect(clientConfig).toContain("sampleRate: 1");
    expect(source).not.toContain("replayIntegration");
    expect(source).not.toContain("feedbackIntegration");
    expect(source).not.toContain("browserProfilingIntegration");
    expect(buildConfig).not.toContain("tunnelRoute");
  });

  it("centralizes capability and identity sanitization", () => {
    expect(clientConfig).toContain("beforeSend: beforeSentrySend");
    expect(clientConfig).toContain("beforeSendTransaction: beforeSentryTransaction");
    expect(clientConfig).toContain("beforeSendSpan: beforeSentrySpan");
    expect(clientConfig).toContain("beforeBreadcrumb: beforeSentryBreadcrumb");
    expect(sanitizer).toContain("CAPABILITY_PATH_PATTERN");
    expect(sanitizer).toContain("delete event.user");
    expect(sanitizer).toContain("delete event.extra");
  });

  it("does not add a public crash route or alter the service worker", () => {
    expect(globalError).toContain("Sentry.captureException(error");
    expect(fs.existsSync(path.join(process.cwd(), "app/sentry-example-page"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(process.cwd(), "app/api/sentry-example-api"))).toBe(
      false,
    );
    expect(source).not.toContain("service-worker.js");
  });
});
