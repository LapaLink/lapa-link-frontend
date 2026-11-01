import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    // Requests are intercepted by the contract fixture. No real OTP, account,
    // complaint or moderation operation is sent to a backend by these tests.
    env: {
      BACKEND_API_URL: process.env.BACKEND_API_URL || "http://127.0.0.1:3100",
    },
  },
})
