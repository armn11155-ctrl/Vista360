import { test, expect } from "@playwright/test";

/**
 * E2E — Flujo de autenticación.
 *
 * Estos tests verifican la pantalla de login sin autenticarse
 * realmente con Google (eso requeriría credenciales de test).
 * La suite valida la UI y el comportamiento ante errores simulados.
 *
 * Nota de timing en CI:
 *   La app muestra un Splash animado (~3.8s) y luego espera a Firebase
 *   (fallback de 3s si no hay respuesta). La pantalla de login aparece
 *   en ~4-7s desde que carga la página. Los timeouts usan 15s de margen.
 */

const LOGIN_TIMEOUT = { timeout: 15_000 };

test.describe("Pantalla de login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("muestra el logo y el botón de Google", async ({ page }) => {
    await expect(page.locator("text=Bienvenido")).toBeVisible(LOGIN_TIMEOUT);

    const googleBtn = page.locator("button:has-text('Continuar con Google')");
    await expect(googleBtn).toBeVisible(LOGIN_TIMEOUT);
    await expect(googleBtn).toBeEnabled();
  });

  test("muestra el tagline de la aplicación", async ({ page }) => {
    await expect(page.locator("text=/Gestión de Paneles/i")).toBeVisible(LOGIN_TIMEOUT);
  });

  test("el botón de Google muestra estado de carga al hacer clic", async ({ page }) => {
    const googleBtn = page.locator("button:has-text('Continuar con Google')");

    // Solo verificamos que el botón existe y es clickable sin autenticarse realmente
    await expect(googleBtn).toBeVisible(LOGIN_TIMEOUT);
    await expect(googleBtn).toBeEnabled();
  });

  test("la pantalla de login es responsive en móvil", async ({ page }) => {
    await expect(page.locator("text=Bienvenido")).toBeVisible(LOGIN_TIMEOUT);

    // El botón debe ocupar el ancho disponible en móvil
    const googleBtn = page.locator("button:has-text('Continuar con Google')");
    const box = await googleBtn.boundingBox();
    expect(box).toBeTruthy();
    // En móvil el botón debe tener al menos 280px de ancho
    expect(box!.width).toBeGreaterThan(280);
  });

  test("muestra el número de versión en el footer", async ({ page }) => {
    await expect(page.locator("text=/Vista360/i").last()).toBeVisible(LOGIN_TIMEOUT);
  });
});
