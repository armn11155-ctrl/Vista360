import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Flujo de contratos (requiere usuario autenticado).
 *
 * Para ejecutar estos tests contra una instancia real necesitas:
 *   1. Autenticarte y guardar el estado de sesión con `playwright/auth.setup.ts`
 *   2. Configurar E2E_BASE_URL apuntando a staging
 *
 * En CI sin credenciales reales, estos tests se saltan automáticamente
 * si no hay sesión activa (skipWhenNotAuthenticated).
 */

/** Navega a la pestaña de Contratos y espera que cargue */
async function irAContratos(page: Page) {
  const contratoTab = page.locator('[aria-label="Contratos"], button:has-text("Contratos")').first();
  await contratoTab.click();
  await expect(page.locator("text=Contratos").first()).toBeVisible({ timeout: 8_000 });
}

test.describe("Flujo de contratos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("la página carga sin errores de consola críticos", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error" && !msg.text().includes("Firebase")) {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(3_000);
    expect(errors.filter(e => e.includes("TypeError") || e.includes("ReferenceError"))).toHaveLength(0);
  });

  test("muestra el splash/loading o la pantalla de login al iniciar", async ({ page }) => {
    // La app muestra un Splash (~3.8s) y luego el login o el dashboard.
    const hasContent = await Promise.race([
      page.locator("text=Bienvenido").waitFor({ timeout: 12_000 }).then(() => "login"),
      page.locator("text=Resumen").waitFor({ timeout: 12_000 }).then(() => "app"),
    ]).catch(() => "timeout");

    // Aserción clara: hasContent debe ser "login" o "app", no "timeout".
    // Si falla aquí, la app no cargó ningún contenido en 12s — revisar
    // el webServer y los secrets de Firebase en CI.
    expect(
      hasContent,
      `La app no cargó en 12s. ¿El build tiene las variables VITE_FIREBASE_* bakeadas? hasContent="${hasContent}"`,
    ).toMatch(/^(login|app)$/);
  });
});

test.describe("Creación de contrato (requiere sesión)", () => {
  test.skip(!!process.env.CI && !process.env.E2E_AUTH_TOKEN, "Requiere token de auth para CI");

  test("botón Nuevo Contrato abre el modal", async ({ page }) => {
    await page.goto("/");

    const isLoggedIn = await page
      .locator("text=Resumen")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    await irAContratos(page);

    const nuevoBtn = page.locator("button:has-text('Nuevo')").first();
    await expect(nuevoBtn).toBeVisible();
    await nuevoBtn.click();

    await expect(page.locator("text=Nuevo Contrato")).toBeVisible({ timeout: 3_000 });
  });

  test("el modal de contrato tiene los campos requeridos", async ({ page }) => {
    await page.goto("/");
    const isLoggedIn = await page
      .locator("text=Resumen")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    await irAContratos(page);
    const nuevoBtn = page.locator("button:has-text('Nuevo')").first();
    await nuevoBtn.click();

    await expect(page.locator("text=Nuevo Contrato")).toBeVisible({ timeout: 3_000 });

    await expect(
      page.locator("select, [aria-label*='Panel'], [placeholder*='panel' i]").first(),
    ).toBeVisible();
    await expect(page.locator("input[type='date']").first()).toBeVisible();
    await expect(
      page.locator("[placeholder*='1500'], input[inputmode='decimal']").first(),
    ).toBeVisible();
  });

  test("validación impide crear contrato sin panel seleccionado", async ({ page }) => {
    await page.goto("/");
    const isLoggedIn = await page
      .locator("text=Resumen")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!isLoggedIn) {
      test.skip();
      return;
    }

    await irAContratos(page);
    const nuevoBtn = page.locator("button:has-text('Nuevo')").first();
    await nuevoBtn.click();

    await expect(page.locator("text=Nuevo Contrato")).toBeVisible({ timeout: 3_000 });

    const guardarBtn = page
      .locator("button:has-text('Crear Contrato'), button:has-text('Guardar')")
      .last();
    await guardarBtn.click();

    await expect(
      page.locator("text=/selecciona un panel/i, text=/panel.*requerido/i, text=/completa/i").first(),
    ).toBeVisible({ timeout: 3_000 });
  });
});
