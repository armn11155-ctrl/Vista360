import { describe, it, expect, vi } from "vitest";

vi.mock("../config/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
}));
vi.mock("../context/UIContext", () => ({
  toast: vi.fn(),
  confirmAsync: vi.fn(),
}));

const { fmt, fmtF, fmtK, dias, mesLabel, hoy, mesHoy } = await import("./utils");

describe("fmt", () => {
  it("formatea número con símbolo S/ y dos decimales", () => {
    const result = fmt(1234.5);
    expect(result).toContain("S/");
    expect(result).toMatch(/1[.,]234/); // separador de miles puede variar por locale
  });

  it("formatea 0 correctamente", () => {
    expect(fmt(0)).toContain("0,00");
  });

  it("acepta null sin lanzar", () => {
    expect(() => fmt(null)).not.toThrow();
  });

  it("acepta undefined sin lanzar", () => {
    expect(() => fmt(undefined)).not.toThrow();
  });
});

describe("fmtK", () => {
  it("muestra K para miles", () => {
    expect(fmtK(1500)).toContain("K");
  });

  it("muestra M para millones", () => {
    expect(fmtK(1_200_000)).toContain("M");
  });

  it("usa fmt normal para números pequeños", () => {
    expect(fmtK(500)).toContain("S/");
    expect(fmtK(500)).not.toContain("K");
  });
});

describe("fmtF", () => {
  it("formatea fecha ISO a formato legible en es-PE", () => {
    const result = fmtF("2025-05-26");
    expect(result).toContain("2025");
    expect(result).not.toBe("—");
  });

  it("devuelve — para string vacío", () => {
    expect(fmtF("")).toBe("—");
  });

  it("devuelve — para null", () => {
    expect(fmtF(null)).toBe("—");
  });

  it("devuelve — para undefined", () => {
    expect(fmtF(undefined)).toBe("—");
  });
});

describe("dias", () => {
  it("devuelve número positivo para fecha futura", () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().split("T")[0];
    expect(dias(future)).toBeGreaterThan(0);
  });

  it("devuelve número negativo para fecha pasada", () => {
    expect(dias("2020-01-01")).toBeLessThan(0);
  });
});

describe("mesLabel", () => {
  it("devuelve nombre del mes en español para mayo", () => {
    expect(mesLabel("2025-05")).toMatch(/mayo/i);
  });

  it("devuelve nombre del mes en español para enero", () => {
    expect(mesLabel("2025-01")).toMatch(/enero/i);
  });

  it("devuelve nombre del mes en español para diciembre", () => {
    expect(mesLabel("2025-12")).toMatch(/diciembre/i);
  });

  it("comienza con mayúscula", () => {
    const result = mesLabel("2025-03");
    expect(result[0]).toBe(result[0].toUpperCase());
  });
});

describe("hoy", () => {
  it("devuelve un objeto Date", () => {
    expect(hoy()).toBeInstanceOf(Date);
  });

  it("la fecha devuelta es aproximadamente ahora", () => {
    const now = Date.now();
    const diff = Math.abs(hoy().getTime() - now);
    expect(diff).toBeLessThan(1000);
  });
});

describe("mesHoy", () => {
  it("devuelve string en formato YYYY-MM", () => {
    expect(mesHoy()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("coincide con el año y mes actuales", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(mesHoy()).toBe(expected);
  });
});
