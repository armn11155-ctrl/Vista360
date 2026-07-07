import { describe, it, expect, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

import { AppProvider, useAppData, useAppSetters, useAppDerived } from "./AppContext";

const emptyData = {
  paneles: [],
  clientes: [],
  contratos: [],
  gastos: [],
  proveedores: [],
  loading: false,
  error: null,
  refetch: () => {},
};
const emptySetters = {
  setPaneles: vi.fn(),
  setClientes: vi.fn(),
  setContratos: vi.fn(),
  setGastos: vi.fn(),
  setProveedores: vi.fn(),
};
const emptyDerived = {
  contractsActive: [],
  clientesActive: [],
  proveedoresActive: [],
  trashCount: 0,
  notifCount: 0,
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider data={emptyData} setters={emptySetters} derived={emptyDerived}>
      {children}
    </AppProvider>
  );
}

describe("AppProvider", () => {
  it("renderiza sus hijos sin errores", () => {
    const { getByText } = render(
      <AppProvider data={emptyData} setters={emptySetters} derived={emptyDerived}>
        <span>contenido</span>
      </AppProvider>,
    );
    expect(getByText("contenido")).toBeTruthy();
  });
});

describe("useAppData", () => {
  it("devuelve datos del contexto", () => {
    const { result } = renderHook(() => useAppData(), { wrapper: Wrapper });
    expect(result.current.paneles).toEqual([]);
    expect(result.current.clientes).toEqual([]);
  });

  it("expone refetch como función", () => {
    const { result } = renderHook(() => useAppData(), { wrapper: Wrapper });
    expect(typeof result.current.refetch).toBe("function");
  });

  it("lanza error fuera del proveedor", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAppData())).toThrow();
    spy.mockRestore();
  });
});

describe("useAppSetters", () => {
  it("devuelve los setters del contexto", () => {
    const { result } = renderHook(() => useAppSetters(), { wrapper: Wrapper });
    expect(typeof result.current.setPaneles).toBe("function");
  });

  it("lanza error fuera del proveedor", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAppSetters())).toThrow();
    spy.mockRestore();
  });
});

describe("useAppDerived", () => {
  it("devuelve los datos derivados del contexto", () => {
    const { result } = renderHook(() => useAppDerived(), { wrapper: Wrapper });
    expect(result.current).toBeDefined();
  });
});
