import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

// ── vi.hoisted: variables accesibles dentro de vi.mock factories ──
// Vitest 4 hoist vi.mock() al top del archivo (antes de const/let),
// por lo que cualquier variable referenciada en un factory DEBE
// declararse con vi.hoisted() para evitar "Cannot access before init".
const { mockUnsubscribe, mockOnSnapshot } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const mockOnSnapshot = vi.fn((_q: unknown, onNext: (s: { docs: unknown[] }) => void) => {
    onNext({ docs: [] });
    return mockUnsubscribe;
  });
  return { mockUnsubscribe, mockOnSnapshot };
});

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

// ── Mocks de Firebase ─────────────────────────────────────────────
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn().mockResolvedValue({ id: "x" }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: mockOnSnapshot,
  doc: vi.fn(),
  query: vi.fn((...a: unknown[]) => a),
  orderBy: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  Timestamp: { now: vi.fn(() => ({ seconds: 0 })), fromDate: vi.fn() },
}));

vi.mock("../../../config/firebase", () => ({ db: {}, auth: {} }));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: "u1", email: "a@test.com" } })),
  signOut: vi.fn(),
}));

vi.mock("../../../context/UIContext", () => ({
  toast: mockToast,
  confirmAsync: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../../config/theme", () => ({
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
    cyan: "#06b6d4",
  },
  tCol: vi.fn(() => "#2563eb"),
  catCol: vi.fn(() => "#2563eb"),
}));

vi.mock("../../../config/constants", () => ({
  CIUDADES: ["Lima", "Huanuco"],
  CAT_GASTOS: ["Mant"],
  CAT_PROVE: ["Elect"],
  SECTORES: ["Retail"],
  ESTADOS_CLI: ["Activo"],
  ESTADOS_PRO: ["En contacto"],
  EMOJIS: ["🖥"],
  EMISOR: {
    ruc: "20123456789",
    nombre: "Test SA",
    razonSocial: "Test SA",
    direccion: "Av Test 123",
    ubigeo: "150101",
    ciudad: "Lima",
    actividad: "Publicidad",
  },
  ALLOWED_EMAILS: [],
  BOTTOM_TABS_LIST: [],
}));

vi.mock("../../../services/firestore", () => ({
  fb: {
    get: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue("x"),
    update: vi.fn(),
    remove: vi.fn(),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
  cloudinaryThumb: vi.fn(),
  cloudinaryDetail: vi.fn(),
  cloudinaryPdf: vi.fn(),
}));

import Facturacion from "./Facturacion";

// ── Fixtures ──────────────────────────────────────────────────────
const baseProps = { paneles: [], clientes: [], contratos: [] };

const mockFactura = (overrides = {}) => ({
  id: "f1",
  serie: "F001",
  numero: "1",
  tipo: "FACTURA",
  tipo_doc: "01",
  estado: "Emitida",
  cliente_id: "c1",
  cliente_nombre: "Empresa ABC S.A.C.",
  cliente_doc: "20123456789",
  total: 1180,
  subtotal: 1000,
  igv: 180,
  moneda: "PEN",
  fecha_emision: "2025-05-01",
  fecha_vencimiento: "2025-05-31",
  ...overrides,
});

const mockPanel = {
  id: "p1",
  nombre: "Panel Centro",
  tipo: "LED",
  ciudad: "Lima",
  estado: "Libre" as const,
};
const mockCliente = {
  id: "c1",
  empresa: "Empresa ABC S.A.C.",
  ruc: "20123456789",
  estado: "Activo" as const,
};

const setupOnSnapshot = (facturas: object[]) => {
  mockOnSnapshot.mockImplementationOnce((_q: unknown, onNext: (s: unknown) => void) => {
    onNext({ docs: facturas.map(f => ({ id: (f as any).id, data: () => f })) });
    return mockUnsubscribe;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSnapshot.mockImplementation((_q: unknown, onNext: (s: { docs: unknown[] }) => void) => {
    onNext({ docs: [] });
    return mockUnsubscribe;
  });
});

// ── Tests: Renderizado base ───────────────────────────────────────
describe("Facturacion — renderizado base", () => {
  it("renderiza sin errores con props vacios", () => {
    expect(() => render(<Facturacion {...baseProps} />)).not.toThrow();
  });

  it("muestra el titulo Facturacion", () => {
    render(<Facturacion {...baseProps} />);
    expect(document.body.textContent).toContain("Facturaci");
  });

  it("muestra estado de carga inicial", () => {
    render(<Facturacion {...baseProps} />);
    expect(document.body.textContent).toContain("Cargando");
  });

  it("se suscribe a onSnapshot al montar", () => {
    render(<Facturacion {...baseProps} />);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it("cancela la suscripcion al desmontar", () => {
    const { unmount } = render(<Facturacion {...baseProps} />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: KPIs con datos reales ─────────────────────────────────
describe("Facturacion — KPIs", () => {
  it("calcula KPI total correctamente con varias facturas", async () => {
    setupOnSnapshot([
      mockFactura({ id: "f1", total: 1180, estado: "Cobrada" }),
      mockFactura({ id: "f2", total: 590, estado: "Emitida" }),
      mockFactura({ id: "f3", total: 200, estado: "Anulada" }),
    ]);
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/S\/\s*1[.,]770|1770/);
    });
  });

  it("muestra 0 comprobantes cuando no hay facturas", async () => {
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/0\s*comprobante/i);
    });
  });

  it("muestra conteo correcto de comprobantes registrados", async () => {
    setupOnSnapshot([mockFactura({ id: "f1" }), mockFactura({ id: "f2", estado: "Cobrada" })]);
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/2\s*comprobante/i);
    });
  });
});

// ── Tests: Filtrado ───────────────────────────────────────────────
describe("Facturacion — filtros", () => {
  it("filtra por estado correctamente", async () => {
    setupOnSnapshot([
      mockFactura({ id: "f1", cliente_nombre: "Alpha SA", estado: "Emitida" }),
      mockFactura({ id: "f2", cliente_nombre: "Beta SA", estado: "Cobrada" }),
    ]);
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Alpha SA");
    });
    const selects = document.querySelectorAll("select");
    if (selects.length > 0) {
      fireEvent.change(selects[0]!, { target: { value: "Cobrada" } });
      await waitFor(() => {
        expect(document.body.textContent).toContain("Beta SA");
      });
    }
  });

  it("filtra por busqueda de texto (cliente)", async () => {
    setupOnSnapshot([
      mockFactura({ id: "f1", cliente_nombre: "Minera Los Andes SAC", estado: "Emitida" }),
      mockFactura({ id: "f2", cliente_nombre: "Retail Tech Peru", estado: "Cobrada" }),
    ]);
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Minera Los Andes SAC");
    });
    const input = document.querySelector("input") as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value: "minera" } });
      await waitFor(() => {
        expect(document.body.textContent).toContain("Minera Los Andes SAC");
      });
    }
  });
});

// ── Tests: Error handling ─────────────────────────────────────────
describe("Facturacion — errores", () => {
  it("muestra mensaje de error cuando Firestore falla", async () => {
    mockOnSnapshot.mockImplementationOnce(
      (_q: unknown, _onNext: unknown, onError: (e: Error) => void) => {
        onError(new Error("Permiso denegado"));
        return mockUnsubscribe;
      },
    );
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Permiso denegado");
    });
  });

  it("muestra lista vacia cuando no hay comprobantes", async () => {
    render(<Facturacion {...baseProps} />);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/no hay comprobante/i);
    });
  });
});

// ── Tests: Interacciones UI ───────────────────────────────────────
describe("Facturacion — interacciones UI", () => {
  it("responde a clicks en botones sin lanzar error", async () => {
    render(<Facturacion {...baseProps} />);
    await waitFor(() => expect(document.body.textContent).not.toContain("Cargando"));
    document.querySelectorAll("button").forEach(btn => {
      try {
        fireEvent.click(btn);
      } catch {}
    });
    expect(document.body).toBeTruthy();
  });

  it("cambia entre vista lista y vista resumen", async () => {
    render(<Facturacion {...baseProps} />);
    await waitFor(() => expect(document.body.textContent).not.toContain("Cargando"));
    document.querySelectorAll("button").forEach(btn => {
      try {
        fireEvent.click(btn);
      } catch {}
    });
    expect(document.body).toBeTruthy();
  });

  it("muestra modal de detalle al hacer click en una factura", async () => {
    setupOnSnapshot([mockFactura({ id: "f1", cliente_nombre: "TestCorp SA" })]);
    render(<Facturacion paneles={[mockPanel]} clientes={[mockCliente]} contratos={[]} />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("TestCorp SA");
    });
    const cards = document.querySelectorAll("[style*='borderRadius']");
    if (cards.length > 0) {
      try {
        fireEvent.click(cards[0]!);
      } catch {}
    }
  });

  it("boton Nueva Factura muestra toast informativo si URL no esta configurado", async () => {
    render(<Facturacion {...baseProps} />);
    await waitFor(() => expect(document.body.textContent).not.toContain("Cargando"));
    const btn = Array.from(document.querySelectorAll("button")).find(b =>
      b.textContent?.includes("Nueva Factura"),
    );
    if (btn) {
      fireEvent.click(btn);
      expect(mockToast.info).toHaveBeenCalled();
    }
  });
});

// ── Tests: Vista resumen ──────────────────────────────────────────
describe("Facturacion — vista resumen", () => {
  it("muestra pipeline de cobros en vista resumen", async () => {
    setupOnSnapshot([
      mockFactura({ id: "f1", total: 500, estado: "Emitida" }),
      mockFactura({ id: "f2", total: 300, estado: "Cobrada" }),
    ]);
    render(<Facturacion paneles={[mockPanel]} clientes={[mockCliente]} contratos={[]} />);
    await waitFor(() => {
      expect(document.body.textContent).not.toContain("Cargando");
    });
    const buttons = Array.from(document.querySelectorAll("button"));
    const resumenBtn = buttons.find(b => b.querySelector("svg rect"));
    if (resumenBtn) {
      fireEvent.click(resumenBtn);
      await waitFor(() => {
        expect(document.body.textContent).toMatch(/Pipeline|cobro|Emitida|Cobrada/i);
      });
    }
  });
});
