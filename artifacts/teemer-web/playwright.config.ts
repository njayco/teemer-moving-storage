import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Teemer end-to-end tests.
 *
 * The tests assume both the API server and the web app are already running
 * (via the standard Replit workflows or `pnpm --filter @workspace/api-server dev`
 * and `pnpm --filter @workspace/teemer-web dev`).
 *
 * Configure `BASE_URL` (web app, default http://localhost:25308) and
 * `API_URL` (API server, default http://localhost:8080) to point at your
 * local services. The Stripe webhook simulator also requires
 * `STRIPE_WEBHOOK_SECRET` to be set to whatever the API server is using.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:25308",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
