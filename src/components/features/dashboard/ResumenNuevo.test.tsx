import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("../../config/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../../config/theme", () => ({
  T: {
    bg: "#fff",
    card: "#fff",
    surface: "#f9fafb",
    border: "#e5e7eb",
    text: "#111",
    muted: "#6b7280",
    accent: "#2563eb",
    red: "#ef4444",
    green: "#10b981",
    white: "#fff",
    dark: "#1f2937",
    yellow: "#f59e0b",
  },
  tCol: vi.fn(() => "#2563eb"),
}));
vi.mock("../../config/constants", () => ({
  CIUDADES: ["Lima"],
  CAT_GASTOS: ["Mantenimiento"],
  CAT_PROVE: ["Elect"],
  SECTORES: ["Retail"],
  ESTADOS_CLI: ["Activo"],
  ESTADOS_PRO: ["En contacto"],
  EMOJIS: ["🖥"],
  EMISOR: {},
  ALLOWED_EMAILS: [],
  BOTTOM_TABS_LIST: [],
}));
vi.mock("../../context/UIContext", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  confirmAsync: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../services/firestore", () => ({
  fb: { get: vi.fn().mockResolvedValue([]), subscribe: vi.fn().mockReturnValue(vi.fn()) },
}));

import ResumenNuevo from "./ResumenNuevo";

const props = {
  paneles: [],
  clientes: [],
  contratos: [],
  gastos: [],
  setTab: vi.fn(),
  userName: "Admin",
};

beforeEach(() => vi.clearAllMocks());

describe("ResumenNuevo", () => {
  it("renderiza sin errores con datos vacíos", () => {
    expect(() => render(<ResumenNuevo {...props} />)).not.toThrow();
  });
  it("muestra contenido en pantalla", () => {
    render(<ResumenNuevo {...props} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
  it("renderiza con paneles y contratos", () => {
    const p = [
      {
        id: "p1",
        nombre: "Panel Norte",
        tipo: "LED",
        ciudad: "Lima",
        estado: "Disponible" as const,
      },
    ];
    const c = [
      {
        id: "c1",
        panel_id: "p1",
        cliente_id: "cl1",
        inicio: "2024-01-01",
        fin: "2024-12-31",
        monto: 1500,
        pagado: false,
        pagosMeses: {},
      },
    ];
    expect(() => render(<ResumenNuevo {...props} paneles={p} contratos={c} />)).not.toThrow();
  });
});
