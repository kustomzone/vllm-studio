// CRITICAL
import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const proof = process.env.PLAYWRIGHT_PROOF === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "bun scripts/playwright-webserver.ts",
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
  use: {
    baseURL,
    trace: proof ? "on" : "retain-on-failure",
    screenshot: proof ? "on" : "only-on-failure",
    video: proof ? "on" : "retain-on-failure",
  },
  reporter: [["html", { open: "never" }], ["list"]],
});
