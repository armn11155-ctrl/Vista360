import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dias, fmt, fmtF, mesLabel, mesHoy, validate } from "./utils";

// ── dias ──────────────────────────────────────────────────────────
describe("dias", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01"));
  });
  afterEach(() => vi.useRealTimers());

  it("retorna días positivos para fecha futura", () => {
    expect(dias("2025-06-16")).toBe(15);
  });
  it("retorna 0 para hoy", () => {
    expect(dias("2025-06-01")).toBe(0);
  });
  it("retorna negativo para fecha pasada", () => {
    expect(dias("2025-05-25")).toBeLessThan(0);
  });
});

// ── fmt ───────────────────────────────────────────────────────────
describe("fmt", () => {
  it("formatea número con prefijo S/", () => {
    expect(fmt(1500)).toContain("S/");
    expect(fmt(1500)).toContain("1,500");
  });
  it("maneja null retornando S/ 0.00", () => {
    expect(fmt(null)).toBe("S/ 0.00");
  });
  it("maneja undefined retornando S/ 0.00", () => {
    expect(fmt(undefined)).toBe("S/ 0.00");
  });
  it("incluye dos decimales siempre", () => {
    expect(fmt(100)).toContain("100.00");
  });
});

// ── fmtF ──────────────────────────────────────────────────────────
describe("fmtF", () => {
  it("formatea fecha ISO a string legible", () => {
    const result = fmtF("2025-01-15");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });
  it("retorna '—' para null", () => {
    expect(fmtF(null)).toBe("—");
  });
  it("retorna '—' para undefined", () => {
    expect(fmtF(undefined)).toBe("—");
  });
});

// ── mesLabel ──────────────────────────────────────────────────────
describe("mesLabel", () => {
  it("retorna el nombre del mes capitalizado", () => {
    const result = mesLabel("2025-06");
    expect(result).toMatch(/^[A-ZÁÉÍÓÚ]/);
    expect(typeof result).toBe("string");
  });
});

// ── mesHoy ────────────────────────────────────────────────────────
describe("mesHoy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01"));
  });
  afterEach(() => vi.useRealTimers());

  it("retorna el formato YYYY-MM", () => {
    expect(mesHoy()).toMatch(/^\d{4}-\d{2}$/);
    expect(mesHoy()).toBe("2025-06");
  });
});

// ── validate ──────────────────────────────────────────────────────
describe("validate.ruc", () => {
  it("acepta RUC de persona jurídica válido (20)", () => {
    // RUC real de SUNAT: 20131312955
    expect(validate.ruc("20131312955")).toBeNull();
  });
  it("rechaza RUC con longitud incorrecta", () => {
    expect(validate.ruc("1234567890")).not.toBeNull();
  });
  it("rechaza RUC con dígito verificador incorrecto", () => {
    expect(validate.ruc("20131312956")).not.toBeNull(); // último dígito alterado
  });
  it("retorna null para undefined (campo opcional)", () => {
    expect(validate.ruc(undefined)).toBeNull();
  });
});

describe("validate.email", () => {
  it("acepta email válido", () => {
    expect(validate.email("user@example.com")).toBeNull();
  });
  it("rechaza email sin @", () => {
    expect(validate.email("notanemail")).not.toBeNull();
  });
  it("retorna null para undefined (campo opcional)", () => {
    expect(validate.email(undefined)).toBeNull();
  });
});

describe("validate.fechasContrato", () => {
  it("acepta fechas válidas donde fin > inicio", () => {
    expect(validate.fechasContrato("2025-01-01", "2025-12-31")).toBeNull();
  });
  it("rechaza cuando fin < inicio", () => {
    expect(validate.fechasContrato("2025-12-31", "2025-01-01")).not.toBeNull();
  });
  it("rechaza cuando alguna fecha está vacía", () => {
    expect(validate.fechasContrato("", "2025-12-31")).not.toBeNull();
  });
});

describe("validate.monto", () => {
  it("acepta monto positivo", () => {
    expect(validate.monto(500)).toBeNull();
  });
  it("rechaza monto 0", () => {
    expect(validate.monto(0)).not.toBeNull();
  });
  it("rechaza monto negativo", () => {
    expect(validate.monto(-100)).not.toBeNull();
  });
});

describe("validate.contrato", () => {
  it("rechaza contrato sin panel_id", () => {
    expect(validate.contrato({ cliente_id: "c1", inicio: "2025-01-01", fin: "2025-12-31", monto: 500 })).not.toBeNull();
  });
  it("acepta contrato completo válido", () => {
    expect(validate.contrato({ panel_id: "p1", cliente_id: "c1", inicio: "2025-01-01", fin: "2025-12-31", monto: 500 })).toBeNull();
  });
});
