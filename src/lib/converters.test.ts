import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import { toNumber, toDate } from "./converters";

// ── toNumber ──────────────────────────────────────────────────────
describe("toNumber", () => {
  it("convierte string numérico a number", () => {
    expect(toNumber("42.5")).toBe(42.5);
  });
  it("convierte number a number", () => {
    expect(toNumber(7)).toBe(7);
  });
  it("retorna 0 para null", () => {
    expect(toNumber(null)).toBe(0);
  });
  it("retorna 0 para undefined", () => {
    expect(toNumber(undefined)).toBe(0);
  });
  it("retorna 0 para string vacío", () => {
    expect(toNumber("")).toBe(0);
  });
  it("retorna 0 para string no numérico", () => {
    expect(toNumber("abc")).toBe(0);
  });
  it("preserva coordenadas negativas (hemisferio sur)", () => {
    expect(toNumber("-12.0464")).toBeCloseTo(-12.0464);
  });
});

// ── toDate ────────────────────────────────────────────────────────
describe("toDate", () => {
  it("retorna un Date para un Timestamp de Firestore", () => {
    const ts = Timestamp.fromDate(new Date("2025-01-15"));
    const result = toDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
  });
  it("retorna un Date para un string ISO válido", () => {
    const result = toDate("2024-06-01");
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
  });
  it("retorna new Date() como fallback para null", () => {
    const before = Date.now();
    const result = toDate(null);
    const after  = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
  it("retorna new Date() como fallback para undefined", () => {
    expect(toDate(undefined)).toBeInstanceOf(Date);
  });
  it("retorna new Date() para string inválido", () => {
    expect(toDate("not-a-date")).toBeInstanceOf(Date);
  });
});
