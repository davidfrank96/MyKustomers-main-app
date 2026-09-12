import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/notifications-browser",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3418", trace: "off" },
  webServer: [
    {
      command: "node tests/notifications-browser/fixture-server.mjs",
      url: "http://127.0.0.1:55440/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3418",
      url: "http://127.0.0.1:3418",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3418",
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
  ],
  projects: [
    { name: "notification-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "notification-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
