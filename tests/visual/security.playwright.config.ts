import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "admin-security.spec.ts",
  outputDir: "../../test-results/admin-security-visual",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4175", browserName: "chromium" },
  webServer: {
    command: "node tests/visual/admin-security-server.mjs",
    cwd: "../..",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
  },
});
