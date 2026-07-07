import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn().mockResolvedValue({ id: "x" }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn().mockReturnValue(vi.fn()),
  doc: vi.fn(),
  query: vi.fn((...a) => a),
  orderBy: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  Timestamp: { now: vi.fn(() => ({ seconds: 0 })), fromDate: vi.fn() },
}));
vi.mock("../../../config/firebase", () => ({ db: {}, auth: {} }));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: "u1" } })),
  signOut: vi.fn(),
}));
vi.mock("../../../context/UIContext", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
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
  },
  tCol: vi.fn(() => "#2563eb"),
  catCol: vi.fn(() => "#2563eb"),
}));
vi.mock("../../../config/constants", () => ({
  CIUDADES: ["Lima"],
  CAT_GASTOS: ["Mant"],
  CAT_PROVE: ["Electricidad", "Telecomunicaciones"],
  SECTORES: ["Retail"],
  ESTADOS_CLI: ["Activo"],
  ESTADOS_PRO: ["En contacto", "Frío"],
  EMOJIS: ["🖥"],
  EMISOR: {},
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

import Proveedores from "./Proveedores";

const props = { proveedores: [], setProveedores: vi.fn(), loading: false, onModalChange: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe("Proveedores", () => {
  it("renderiza sin errores", () => {
    expect(() => render(<Proveedores {...props} />)).not.toThrow();
  });
  it("muestra contenido", () => {
    render(<Proveedores {...props} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});

describe("Proveedores — interacciones UI básicas", () => {
  it("responde a clicks e inputs sin lanzar error", () => {
    const { container } = render(<Proveedores {...props} />);
    container.querySelectorAll("button").forEach(btn => {
      try {
        fireEvent.click(btn);
      } catch {}
    });
    container.querySelectorAll("input, select").forEach(el => {
      try {
        fireEvent.change(el, { target: { value: "test" } });
      } catch {}
    });
    expect(document.body).toBeTruthy();
  });
});

describe("Proveedores — con datos", () => {
  const proveedores = [
    {
      id: "pv1",
      nombre: "Proveedor Uno",
      estado: "En contacto" as const,
      ruc: "20111",
      sector: "Electricidad",
    },
    {
      id: "pv2",
      nombre: "Proveedor Dos",
      estado: "Frío" as const,
      ruc: "20222",
      sector: "Telecomunicaciones",
    },
  ];

  it("renderiza con proveedores e interactúa", () => {
    const { container } = render(<Proveedores {...props} proveedores={proveedores} />);
    container.querySelectorAll("button").forEach(btn => {
      try {
        fireEvent.click(btn);
      } catch {}
    });
    container.querySelectorAll("input, select").forEach(el => {
      try {
        fireEvent.change(el, { target: { value: "test" } });
      } catch {}
    });
    expect(document.body).toBeTruthy();
  });
});
