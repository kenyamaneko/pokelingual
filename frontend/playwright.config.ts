import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:15151",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "cd .. && docker compose -f docker-compose.dev.yml up --build",
    port: 15151,
    timeout: 120000,
    reuseExistingServer: true,
  },
});
