import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { HEADER_COLORS, TAB_TITLES, useHeaderShell } from "./useHeaderShell";
import type { User } from "firebase/auth";

const mockUser = (email: string, displayName?: string) =>
  ({ email, displayName: displayName ?? null, uid: "u1" }) as User;

const wrapper =
  (path = "/") =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries: [path] }, children);

describe("HEADER_COLORS", () => {
  it("define colores para rutas conocidas", () => {
    expect(HEADER_COLORS["/"]).toBeDefined();
    expect(HEADER_COLORS["/capital"]).toBeDefined();
    expect(HEADER_COLORS["/mapa"]).toBeDefined();
  });
});

describe("TAB_TITLES", () => {
  it("define títulos para todas las rutas principales", () => {
    const routes = ["/paneles", "/contratos", "/gastos", "/reportes", "/crm", "/facturacion"];
    routes.forEach(r => expect(TAB_TITLES[r]).toBeTruthy());
  });
});

describe("useHeaderShell", () => {
  it("extrae userName desde displayName", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("a@b.com", "Juan Pérez"), false), {
      wrapper: wrapper("/"),
    });
    expect(result.current.userName).toBe("Juan Pérez");
  });

  it("genera userName desde email cuando no hay displayName", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("admin@empresa.com"), false), {
      wrapper: wrapper("/"),
    });
    expect(result.current.userName).toBe("Admin");
  });

  it("genera iniciales de una sola palabra", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("x@y.com", "Carlos"), false), {
      wrapper: wrapper("/"),
    });
    expect(result.current.userInitials).toBe("CA");
  });

  it("genera iniciales de nombre compuesto", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("x@y.com", "Juan Pérez"), false), {
      wrapper: wrapper("/"),
    });
    expect(result.current.userInitials).toBe("JP");
  });

  it("retorna iniciales '?' para usuario sin nombre ni email", () => {
    const { result } = renderHook(
      () => useHeaderShell({ email: null, displayName: null, uid: "u1" } as unknown as User, false),
      { wrapper: wrapper("/") },
    );
    expect(result.current.userInitials).toBe("?");
  });

  it("headerDark es false en ruta sin color personalizado", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("x@y.com"), false), {
      wrapper: wrapper("/desconocida"),
    });
    // Unknown routes fall back to T.bg → headerDark = false
    expect(result.current.headerDark).toBe(false);
  });

  it("headerDark es true para rutas con color oscuro", () => {
    const { result } = renderHook(() => useHeaderShell(mockUser("x@y.com"), false), {
      wrapper: wrapper("/mapa"),
    });
    expect(result.current.headerDark).toBe(true);
  });
});
