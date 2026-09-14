import { defineConfig, devices } from "@playwright/test";
const production = process.env.NOTIFICATIONS_PRODUCTION_BUILD === "1";
const origin = production ? "https://127.0.0.1:3419" : "http://127.0.0.1:3418";
export default defineConfig({
  testDir: "./tests/notifications-browser",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: origin, trace: "off", ignoreHTTPSErrors: production },
  webServer: [
    {
      command: "node tests/notifications-browser/fixture-server.mjs",
      url: "http://127.0.0.1:55440/health",
      reuseExistingServer: false,
    },
    {
      command: production
        ? `${process.env.NOTIFICATIONS_REUSE_BUILD === "1" ? "" : "npm run build && "}npm run start -- --hostname 127.0.0.1 --port 3418`
        : "npm run dev -- --hostname 127.0.0.1 --port 3418",
      url: "http://127.0.0.1:3418",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_APP_URL: origin,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-fixture-key",
        SUPABASE_SERVICE_ROLE_KEY: "local-fixture-service-key",
        NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "B".repeat(87),
        WEB_PUSH_VAPID_PRIVATE_KEY: "local-fixture-private-key",
        WEB_PUSH_VAPID_SUBJECT: "mailto:fixture@example.invalid",
        NOTIFICATION_WORKER_SECRET: "",
        NEXT_PUBLIC_SENTRY_DSN: "",
        SENTRY_DSN: "",
        SENTRY_AUTH_TOKEN: "",
        BREVO_API_KEY: "",
        RESEND_API_KEY: "",
        TRANSACTIONAL_EMAIL_PROVIDER: "development",
        VERCEL_ENV: "production",
      },
    },
    ...(production
      ? [
          {
            command: "node tests/notifications-browser/https-proxy.mjs",
            url: origin,
            ignoreHTTPSErrors: true,
            reuseExistingServer: false,
          },
        ]
      : []),
  ],
  projects: [
    {
      name: "notification-chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: production ? { args: ["--ignore-certificate-errors"] } : undefined,
      },
    },
    { name: "notification-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
