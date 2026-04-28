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
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [["list"]],
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
      use: {
        ...devices["Desktop Chrome"],
        // Allow CI (and local NixOS shells) to point Playwright at a
        // system-installed Chromium binary so we don't need Playwright's
        // bundled headless shell — which depends on glibc / libglib /
        // libnss layouts that Replit's NixOS doesn't provide out of the
        // box. When unset, Playwright uses its own bundled browser.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : undefined,
      },
    },
  ],
});
