import { defineConfig, devices } from "@playwright/test";

const PORT = 3790;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Demo mode with a persona reads sample fixtures from data/*.sample.json and keeps writes in
  // memory, so the suite needs no GitHub or Supabase credentials and never touches real data.
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DEMO_MODE: "true",
      DEMO_PERSONA: "design",
      APP_PASSWORD: "e2e-password",
      COOKIE_SECRET: "e2e-cookie-secret-at-least-32-characters-long",
    },
  },
});
