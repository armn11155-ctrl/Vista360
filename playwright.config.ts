import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — flujos críticos de Vista360.
 *
 * Para ejecutar: npx playwright test
 * Para modo UI:  npx playwright test --ui
 *
 * La variable E2E_BASE_URL permite apuntar a staging o local.
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    /** URL base de la app. Permite usar E2E_BASE_URL=https://vista360.pages.dev */
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",

    /** Captura video y screenshot solo al fallar */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",

    /** Simula iPhone 14 para reflejar el target mobile-first */
    ...devices["iPhone 14"],
  },

  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit-ios",
      use: { ...devices["iPhone 14"] },
    },
  ],

  /** Levanta `npm run dev` si no hay servidor corriendo */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
