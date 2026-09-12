import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["profile-ui/*.spec.ts", "e2e/responsive.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3420", trace: "off" },
  webServer: [
    {
      command: "node tests/profile-ui/fixture-server.mjs",
      url: "http://127.0.0.1:55441/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3420",
      url: "http://127.0.0.1:3420",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3420",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55441",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-profile-fixture-key",
        SUPABASE_SERVICE_ROLE_KEY: "local-profile-fixture-service-key",
        NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "",
        WEB_PUSH_VAPID_PRIVATE_KEY: "",
        WEB_PUSH_VAPID_SUBJECT: "",
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit",
      testIgnore: "e2e/responsive.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
