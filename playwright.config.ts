import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — flujos críticos de Vista360.
 *
 * Para ejecutar: npx playwright test
 * Para modo UI:  npx playwright test --ui
 *
 * La variable E2E_BASE_URL permite apuntar a staging o local.
 *
 * Estrategia de servidor:
 *   - CI: Playwright sirve el build de producción con `vite preview`
 *     (los secrets de Firebase se bakean durante el build del job e2e).
 *     Puerto: 4173 (default de vite preview).
 *   - Local: Playwright levanta `vite` en hot-reload.
 *     Puerto: 5173 (default de vite dev).
 */

const isCI = !!process.env.CI;
const LOCAL_PORT = 5173;
const PREVIEW_PORT = 4173;
const localUrl = `http://localhost:${LOCAL_PORT}`;
const previewUrl = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    /** URL base de la app. Permite usar E2E_BASE_URL=https://vista360.pages.dev */
    baseURL: process.env.E2E_BASE_URL ?? (isCI ? previewUrl : localUrl),

    /** Captura video y screenshot solo al fallar */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",

    /** Simula Pixel 7 — target mobile-first */
    ...devices["Pixel 7"],
  },

  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    // webkit-ios omitido: CI solo instala Chromium.
  ],

  /**
   * CI: sirve el build pre-compilado con vite preview.
   *   → Las variables de entorno quedan bakeadas en el bundle.
   *   → No hay HMR ni dependencias de runtime para env vars.
   * Local: levanta el dev server de Vite (no requiere build previo).
   */
  webServer: {
    command: isCI
      ? `npx vite preview --port ${PREVIEW_PORT} --strictPort`
      : "npm run dev",
    port: isCI ? PREVIEW_PORT : LOCAL_PORT,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
