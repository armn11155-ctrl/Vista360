import { describe, it, expect } from "vitest";
import {
  ESTADOS_CLI,
  ESTADOS_PRO,
  SECTORES,
  CIUDADES,
  CAT_GASTOS,
  CAT_PROVE,
  EMOJIS,
  EMISOR,
  ALLOWED_EMAILS,
  BOTTOM_TABS_LIST,
} from "./constants";

describe("constants — valores exportados", () => {
  it("ESTADOS_CLI contiene estados de cliente esperados", () => {
    expect(ESTADOS_CLI).toContain("Activo");
    expect(ESTADOS_CLI).toContain("Inactivo");
    expect(Array.isArray(ESTADOS_CLI)).toBe(true);
  });

  it("ESTADOS_PRO contiene estados de prospecto", () => {
    expect(Array.isArray(ESTADOS_PRO)).toBe(true);
    expect(ESTADOS_PRO.length).toBeGreaterThan(0);
  });

  it("SECTORES es un array de strings", () => {
    expect(Array.isArray(SECTORES)).toBe(true);
    expect(SECTORES.every(s => typeof s === "string")).toBe(true);
  });

  it("CIUDADES incluye Lima", () => {
    expect(CIUDADES).toContain("Lima");
    expect(CIUDADES).toContain("Arequipa");
  });

  it("CAT_GASTOS tiene categorías de gasto", () => {
    expect(Array.isArray(CAT_GASTOS)).toBe(true);
    expect(CAT_GASTOS.length).toBeGreaterThan(0);
  });

  it("CAT_PROVE tiene categorías de proveedor", () => {
    expect(Array.isArray(CAT_PROVE)).toBe(true);
  });

  it("EMOJIS es un array", () => {
    expect(Array.isArray(EMOJIS)).toBe(true);
  });

  it("EMISOR es un objeto", () => {
    expect(typeof EMISOR).toBe("object");
    expect(EMISOR).not.toBeNull();
  });

  it("ALLOWED_EMAILS es un array", () => {
    expect(Array.isArray(ALLOWED_EMAILS)).toBe(true);
  });

  it("BOTTOM_TABS_LIST es un array", () => {
    expect(Array.isArray(BOTTOM_TABS_LIST)).toBe(true);
  });
});
