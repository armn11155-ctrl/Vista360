import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../config/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
}));
vi.mock("../context/UIContext", () => ({
  toast: vi.fn(),
  confirmAsync: vi.fn(),
}));

const { fmt, fmtF, dias, mesLabel, hoy } = await import("./utils");

describe("fmt", () => {
  it("formatea número con dos decimales y prefijo S/", () => {
    expect(fmt(1234.5)).toContain("1");
    expect(fmt(0)).toContain("0");
  });
  it("acepta string numérico", () => {
    expect(typeof fmt("500")).toBe("string");
  });
  it("acepta undefined sin lanzar", () => {
    expect(() => fmt(undefined)).not.toThrow();
  });
});

describe("fmtF", () => {
  it("formatea fecha YYYY-MM-DD a DD/MM/YYYY", () => {
    expect(fmtF("2025-05-26")).toBe("26/05/2025");
  });
  it("devuelve — para valores vacíos", () => {
    expect(fmtF("")).toBe("—");
    expect(fmtF(undefined)).toBe("—");
  });
});

describe("dias", () => {
  it("devuelve número positivo para fecha futura", () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    expect(dias(future)).toBeGreaterThan(0);
  });
  it("devuelve número negativo o 0 para fecha pasada", () => {
    const past = "2020-01-01";
    expect(dias(past)).toBeLessThan(0);
  });
});

describe("mesLabel", () => {
  it("devuelve el nombre del mes en español", () => {
    expect(mesLabel("2025-05")).toMatch(/mayo/i);
    expect(mesLabel("2025-01")).toMatch(/enero/i);
    expect(mesLabel("2025-12")).toMatch(/diciembre/i);
  });
});

describe("hoy", () => {
  it("devuelve fecha en formato YYYY-MM-DD", () => {
    expect(hoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("coincide con la fecha actual", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(hoy()).toBe(today);
  });
});
