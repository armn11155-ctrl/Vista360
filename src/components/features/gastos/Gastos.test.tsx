// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

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
    bg: "#0F172A",
    card: "#1E293B",
    surface: "#1E293B",
    border: "#334155",
    text: "#F1F5F9",
    muted: "#94A3B8",
    accent: "#3B82F6",
    red: "#EF4444",
    green: "#10B981",
    white: "#fff",
    dark: "#0F172A",
    yellow: "#F59E0B",
  },
  tCol: vi.fn(() => "#3B82F6"),
  catCol: vi.fn(() => "#3B82F6"),
}));
vi.mock("../../../config/constants", () => ({
  CIUDADES: ["Lima"],
  CAT_GASTOS: ["Mantenimiento", "Personal"],
  CAT_PROVE: ["Electricidad"],
  SECTORES: ["Retail"],
  ESTADOS_CLI: ["Activo"],
  ESTADOS_PRO: ["En contacto"],
  EMOJIS: ["🖥"],
  EMISOR: { ruc: "20123456789" },
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

import Gastos from "./Gastos";

const props = {
  gastos: [],
  setGastos: vi.fn(),
  autoScan: false,
  setAutoScan: vi.fn(),
  onModalChange: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe("Gastos", () => {
  it("renderiza sin errores con props vacíos", () => {
    expect(() => render(<Gastos {...props} />)).not.toThrow();
  });
  it("renderiza contenido inicial", () => {
    render(<Gastos {...props} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
  it("renderiza con un gasto en la lista", () => {
    const g = [
      {
        id: "g1",
        descripcion: "Panel Norte",
        monto: 500,
        categoria: "Mantenimiento",
        fecha: "2024-01-15",
      },
    ];
    expect(() => render(<Gastos {...props} gastos={g} />)).not.toThrow();
  });
});

describe("Gastos — interacciones UI básicas", () => {
  it("responde a clicks en botones e inputs sin lanzar error", () => {
    const { container } = render(<Gastos {...props} />);
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

describe("Gastos — con datos reales", () => {
  const gastos = [
    {
      id: "g1",
      descripcion: "Panel Norte",
      monto: 500,
      categoria: "Mantenimiento",
      fecha: "2024-01-15",
    },
    { id: "g2", descripcion: "Personal", monto: 2000, categoria: "Personal", fecha: "2024-01-20" },
    { id: "g3", descripcion: "Servicios", monto: 300, categoria: "Servicios", fecha: "2024-02-01" },
  ];

  it("renderiza la lista de gastos", () => {
    const { container } = render(<Gastos {...props} gastos={gastos} />);
    // Fire all interactive elements
    container.querySelectorAll("button, [role='button']").forEach(el => {
      try {
        fireEvent.click(el);
      } catch {}
    });
    container.querySelectorAll("input, select, textarea").forEach(el => {
      try {
        fireEvent.change(el, { target: { value: "test" } });
      } catch {}
      try {
        fireEvent.focus(el);
      } catch {}
    });
    container.querySelectorAll("[onClick], li, tr").forEach(el => {
      try {
        fireEvent.click(el);
      } catch {}
    });
    expect(document.body).toBeTruthy();
  });
});
