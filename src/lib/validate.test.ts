/**
 * Tests de las funciones de validación de negocio (validate.*)
 * Estas funciones son críticas: deciden si un gasto, contrato, panel
 * o cliente puede guardarse en Firestore.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {}, storage: {} }));
vi.mock("../context/UIContext", () => ({ toast: vi.fn(), confirmAsync: vi.fn() }));

const { validate } = await import("./utils");

// ── validate.monto ─────────────────────────────────────────────────
describe("validate.monto", () => {
  it("retorna null para monto positivo", () => {
    expect(validate.monto(100)).toBeNull();
    expect(validate.monto(0.01)).toBeNull();
  });

  it("rechaza monto 0", () => {
    expect(validate.monto(0)).not.toBeNull();
  });

  it("rechaza monto negativo", () => {
    expect(validate.monto(-50)).not.toBeNull();
  });

  it("rechaza NaN", () => {
    expect(validate.monto(NaN)).not.toBeNull();
  });

  it("acepta string numérico positivo", () => {
    expect(validate.monto("250.50")).toBeNull();
  });
});

// ── validate.ruc ──────────────────────────────────────────────────
describe("validate.ruc", () => {
  it("retorna null para RUC válido (empresa)", () => {
    // RUC 20 válido: dígito verificador calculado = 1, por lo tanto termina en 1
    expect(validate.ruc("20100070971")).toBeNull();
  });

  it("retorna null para RUC válido (persona natural)", () => {
    // RUC 10 conocido válido: 10467793549
    expect(validate.ruc("10467793549")).toBeNull();
  });

  it("rechaza RUC con menos de 11 dígitos", () => {
    expect(validate.ruc("2010007097")).not.toBeNull();
  });

  it("rechaza RUC con más de 11 dígitos", () => {
    expect(validate.ruc("201000709701")).not.toBeNull();
  });

  it("rechaza RUC que no empieza por 10 o 20", () => {
    expect(validate.ruc("30000000000")).not.toBeNull();
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(validate.ruc("20100070970")).not.toBeNull(); // último dígito correcto es 1, no 0
  });

  it("retorna null para valor undefined (campo opcional)", () => {
    expect(validate.ruc(undefined)).toBeNull();
  });

  it("retorna null para string vacío (campo opcional)", () => {
    expect(validate.ruc("")).toBeNull();
  });
});

// ── validate.email ────────────────────────────────────────────────
describe("validate.email", () => {
  it("acepta email válido", () => {
    expect(validate.email("alan@8millas.pe")).toBeNull();
    expect(validate.email("user+tag@sub.domain.com")).toBeNull();
  });

  it("rechaza email sin arroba", () => {
    expect(validate.email("no-arroba.com")).not.toBeNull();
  });

  it("rechaza email sin dominio", () => {
    expect(validate.email("user@")).not.toBeNull();
  });

  it("retorna null para undefined (campo opcional)", () => {
    expect(validate.email(undefined)).toBeNull();
  });
});

// ── validate.fechasContrato ───────────────────────────────────────
describe("validate.fechasContrato", () => {
  it("acepta fechas válidas con inicio antes de fin", () => {
    expect(validate.fechasContrato("2025-01-01", "2025-12-31")).toBeNull();
  });

  it("rechaza cuando fin es anterior a inicio", () => {
    expect(validate.fechasContrato("2025-06-01", "2025-01-01")).not.toBeNull();
  });

  it("acepta inicio igual a fin (contrato de un día)", () => {
    expect(validate.fechasContrato("2025-06-01", "2025-06-01")).toBeNull();
  });

  it("rechaza fechas vacías", () => {
    expect(validate.fechasContrato("", "2025-12-31")).not.toBeNull();
    expect(validate.fechasContrato("2025-01-01", "")).not.toBeNull();
  });
});

// ── validate.gasto ────────────────────────────────────────────────
describe("validate.gasto", () => {
  const gastoBase = {
    descripcion: "Pintura",
    monto: 450,
    categoria: "Mantenimiento",
    fecha: "2025-05-15",
  };

  it("acepta gasto con todos los campos", () => {
    expect(validate.gasto(gastoBase)).toBeNull();
  });

  it("rechaza descripción vacía", () => {
    expect(validate.gasto({ ...gastoBase, descripcion: "" })).not.toBeNull();
    expect(validate.gasto({ ...gastoBase, descripcion: "   " })).not.toBeNull();
  });

  it("rechaza monto inválido", () => {
    expect(validate.gasto({ ...gastoBase, monto: 0 })).not.toBeNull();
    expect(validate.gasto({ ...gastoBase, monto: -1 })).not.toBeNull();
  });

  it("rechaza fecha vacía", () => {
    expect(validate.gasto({ ...gastoBase, fecha: "" })).not.toBeNull();
  });
});

// ── validate.contrato ─────────────────────────────────────────────
describe("validate.contrato", () => {
  const contratoBase = {
    panel_id: "panel-1",
    cliente_id: "cliente-1",
    inicio: "2025-01-01",
    fin: "2025-12-31",
    monto: 1200,
  };

  it("acepta contrato válido", () => {
    expect(validate.contrato(contratoBase)).toBeNull();
  });

  it("rechaza sin panel", () => {
    expect(validate.contrato({ ...contratoBase, panel_id: "" })).not.toBeNull();
  });

  it("rechaza sin cliente", () => {
    expect(validate.contrato({ ...contratoBase, cliente_id: "" })).not.toBeNull();
  });

  it("rechaza fechas inválidas", () => {
    expect(validate.contrato({ ...contratoBase, fin: "2024-12-31" })).not.toBeNull();
  });

  it("rechaza monto inválido", () => {
    expect(validate.contrato({ ...contratoBase, monto: 0 })).not.toBeNull();
  });
});

// ── validate.panel ────────────────────────────────────────────────
describe("validate.panel", () => {
  it("acepta panel con nombre", () => {
    expect(validate.panel({ nombre: "Panel Centro" })).toBeNull();
  });

  it("rechaza nombre vacío", () => {
    expect(validate.panel({ nombre: "" })).not.toBeNull();
    expect(validate.panel({ nombre: "   " })).not.toBeNull();
  });
});

// ── validate.cliente ──────────────────────────────────────────────
describe("validate.cliente", () => {
  it("acepta cliente con empresa", () => {
    expect(validate.cliente({ empresa: "Acme S.A." })).toBeNull();
  });

  it("rechaza empresa vacía", () => {
    expect(validate.cliente({ empresa: "" })).not.toBeNull();
  });

  it("rechaza email inválido si está presente", () => {
    expect(validate.cliente({ empresa: "Acme", email: "no-email" })).not.toBeNull();
  });

  it("rechaza RUC inválido si está presente", () => {
    expect(validate.cliente({ empresa: "Acme", ruc: "123" })).not.toBeNull();
  });

  it("acepta sin email ni RUC (campos opcionales)", () => {
    expect(validate.cliente({ empresa: "Acme S.A." })).toBeNull();
  });
});
