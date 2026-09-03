import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "admin-overview.spec.ts",
  outputDir: "../../test-results/admin-overview-visual",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4174", browserName: "chromium" },
  webServer: {
    command: "node tests/visual/admin-overview-server.mjs",
    cwd: "../..",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
