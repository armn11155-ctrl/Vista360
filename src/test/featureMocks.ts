/**
 * Helper de mocks compartidos para las pruebas de los componentes de feature.
 * Importar con: import { setupFeatureMocks } from "../../../test/featureMocks";
 *
 * Uso: llama a setupFeatureMocks() al inicio del archivo de test.
 * Las llamadas vi.mock() deben ser hoisted, así que deberás repetirlas
 * en cada archivo — este helper centraliza la configuración de los stubs.
 */

import { vi } from "vitest";

// ── Datos de prueba vacíos ────────────────────────────────────────
export const emptyPanel = () => ({
  id: "p1",
  nombre: "Panel Test",
  tipo: "LED",
  ciudad: "Lima",
  estado: "Libre" as const,
  foto: "🖥",
  precio: 1500,
  direccion: "Av. Test 123",
});

export const emptyContrato = () => ({
  id: "c1",
  panel_id: "p1",
  cliente_id: "cl1",
  inicio: "2024-01-01",
  fin: "2024-12-31",
  monto: 1500,
  pagado: false,
  pagosMeses: {},
});

export const emptyCliente = () => ({
  id: "cl1",
  empresa: "Test SA",
  estado: "Activo" as const,
  ruc: "20123456789",
});

export const emptyGasto = () => ({
  id: "g1",
  descripcion: "Gasto test",
  monto: 100,
  categoria: "Mantenimiento",
  fecha: "2024-01-15",
});

export const emptyProveedor = () => ({
  id: "pv1",
  nombre: "Proveedor Test",
  estado: "En contacto" as const,
  ruc: "20999888777",
});

// ── Mock del módulo fb ─────────────────────────────────────────────
export const makeFbMock = () => ({
  get: vi.fn().mockResolvedValue([]),
  add: vi.fn().mockResolvedValue("new-id"),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockReturnValue(vi.fn()),
});

// ── Stubs de noop para APIs del navegador ─────────────────────────
export function setupBrowserMocks() {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "scrollTo", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
}
