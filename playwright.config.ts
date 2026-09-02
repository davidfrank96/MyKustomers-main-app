import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

// The fixture suite intentionally exercises many independent accounts in a short
// window. Give each browser project a reserved TEST-NET source so the distributed
// source limiter models separate clients instead of treating the entire matrix as
// one anonymous proxy. Production proxies remain authoritative for this header.
const projectSource = (address: string) => ({
  extraHTTPHeaders: { "x-forwarded-for": address },
});

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  reporter: process.env.CI
    ? [["list"], ["github"], ["json", { outputFile: "test-results/results.json" }]]
    : "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /pwa-reliability\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...projectSource("192.0.2.10") },
    },
    {
      name: "mobile-chrome",
      testIgnore: /pwa-reliability\.spec\.ts/,
      use: { ...devices["Pixel 5"], ...projectSource("192.0.2.11") },
    },
    {
      name: "pwa-chromium",
      testMatch: /pwa-reliability\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...projectSource("192.0.2.12") },
    },
    {
      name: "pwa-mobile-chrome",
      dependencies: ["pwa-chromium"],
      testMatch: /pwa-reliability\.spec\.ts/,
      use: { ...devices["Pixel 5"], ...projectSource("192.0.2.13") },
    },
    {
      name: "pwa-mobile-webkit",
      dependencies: ["pwa-mobile-chrome"],
      testMatch: /pwa-reliability\.spec\.ts/,
      use: { ...devices["iPhone 13"], ...projectSource("192.0.2.14") },
    },
  ],
});
