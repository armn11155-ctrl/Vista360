import { useMemo, useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { T } from "../config/theme";
import { OWNER_EMAILS } from "../config/constants";

export const HEADER_COLORS: Record<string, string> = {
  "/": "#0E1A3B",
  "/paneles": "#07101F",
  "/contratos": "#0E1A3B",
  "/historico": "#0E1A3B",     // Histórico vive dentro de Reportes: mismo color
  "/crm": T.accent,
  "/mapa": "#070D1C",
  "/reportes": "#0E1A3B",      // Reportes + sub-tabs Estado de Resultados / Por Mes / Histórico
  "/facturacion": "#0E1A3B",   // Facturación: misma paleta oscura que el resto de la app
};

export const TAB_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/paneles": "Paneles",
  "/contratos": "Contratos",
  "/historico": "Histórico",
  "/crm": "Clientes",
  "/resultados": "Resultados",
  "/reportes": "Reportes",
  "/gastos": "Gastos",
  "/proveedores": "Proveedores",
  "/facturacion": "Facturación",
  "/mapa": "Mapa",
};

/**
 * useHeaderShell — color del header, título del documento y datos del usuario.
 *
 * Separado para evitar que los cambios de ruta disparen re-renders
 * en los hooks de datos o de UI state.
 */
// ── Cuentas que pertenecen a la misma persona (gerente) ──────────────
// Sin importar con cuál de estos correos inicie sesión, se muestra
// siempre el mismo nombre en toda la app.
const KNOWN_USERS: Record<string, string> = {
  "armn.101@hotmail.com": "Alan Rubén Martínez Núñez",
  "armn.11155@gmail.com": "Alan Rubén Martínez Núñez",
};

export function useHeaderShell(user: User, showProfile: boolean) {
  const location = useLocation();

  const headerColor = showProfile ? T.bg : (HEADER_COLORS[location.pathname] ?? T.bg);
  const headerDark = headerColor !== T.bg;

  // ── theme-color síncrono con useLayoutEffect ─────────────────────────
  // Corre antes del paint — status bar y header cambian en el mismo frame.
  //
  // BUG FIX: Chrome Android no siempre repinta el status bar nativo solo
  // porque cambiamos el atributo `content` de un <meta> que ya existía en
  // el DOM — en la práctica, muchas veces no lo aplica hasta el próximo
  // scroll/gesto, dejando el status bar con el color viejo (se ve "negro")
  // hasta que el usuario desliza una vez. Forzar a Chrome a tratar el meta
  // como nuevo (quitarlo y volver a insertarlo) hace que lo recoja de
  // inmediato, sin depender de que el usuario haga scroll primero.
  useLayoutEffect(() => {
    const old = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (old) old.remove();
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", headerColor);
    document.head.appendChild(meta);
    document.documentElement.style.background = headerColor;
    document.body.style.background = headerColor;
    document.documentElement.style.setProperty("--app-bg", headerColor);
  }, [headerColor]);

  // ── Título del documento ───────────────────────────────────────────
  useEffect(() => {
    const section = showProfile ? "Perfil" : (TAB_TITLES[location.pathname] ?? "Vista360");
    document.title = `${section} | Vista360`;
  }, [location.pathname, showProfile]);

  // ── Datos del usuario ──────────────────────────────────────────────
  const userName = useMemo(() => {
    const email = (user.email ?? "").toLowerCase();
    if (KNOWN_USERS[email]) return KNOWN_USERS[email];
    if (user.displayName) return user.displayName;
    const local = (user.email ?? "").split("@")[0] ?? "";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user]);

  const userInitials = useMemo(() => {
    if (!userName) return "?";
    const parts = userName.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  }, [userName]);

  // ── Dueño vs. trabajador ─────────────────────────────────────────────
  const isOwner = useMemo(
    () => OWNER_EMAILS.includes((user.email ?? "").toLowerCase()),
    [user],
  );

  return {
    headerColor,
    headerDark,
    userName,
    userInitials,
    isOwner,
    pageTitle: TAB_TITLES[location.pathname] ?? "Inicio",
  };
}


