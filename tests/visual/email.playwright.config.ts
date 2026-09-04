import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "admin-email.spec.ts",
  outputDir: "../../test-results/admin-email-visual",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4176", browserName: "chromium" },
  webServer: {
    command: "node tests/visual/admin-email-server.mjs",
    cwd: "../..",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: !process.env.CI,
  },
});
