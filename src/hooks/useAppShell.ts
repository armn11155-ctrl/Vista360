import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "../config/firebase";
import { T } from "../config/theme";
import { useCollection } from "./useCollection";
import { useOnlineStatus } from "./useOnlineStatus";
import { useServiceWorker } from "./useServiceWorker";
import { useNotifications } from "./useNotifications";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "../types";
import type { AppData, AppSetters } from "../types";
import type { AppDerivedData } from "../context/AppContext";

// ── Color del header según ruta ────────────────────────────────────
export const HEADER_COLORS: Record<string, string> = {
  "/": "#0E1A3B",
  "/capital": "#0E1A3B",
  "/contratos": "#0E1A3B",
  "/historico": "#0A0F1A",
  "/crm": T.accent,
  "/mapa": "#070D1C",
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
  "/capital": "Capital",
  "/mapa": "Mapa",
};

export interface AppShellState {
  // UI toggles
  showProfile: boolean;
  setShowProfile: React.Dispatch<React.SetStateAction<boolean>>;
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trashOpen: boolean;
  setTrashOpen: React.Dispatch<React.SetStateAction<boolean>>;
  autoScan: boolean;
  setAutoScan: React.Dispatch<React.SetStateAction<boolean>>;
  globalSearch: boolean;
  setGlobalSearch: React.Dispatch<React.SetStateAction<boolean>>;
  notifOpen: boolean;
  setNotifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  confirmLogout: boolean;
  setConfirmLogout: React.Dispatch<React.SetStateAction<boolean>>;
  anyModalOpen: boolean;
  setAnyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;

  // Derived UI
  isOnline: boolean;
  headerColor: string;
  headerDark: boolean;
  userName: string;
  userInitials: string;
  notifCount: number;
  trashCount: number;

  // Navigation
  handleTabClick: (path: string) => void;

  // Auth
  handleLogout: () => Promise<void>;

  // AppContext values
  appData: AppData;
  appSetters: AppSetters;
  appDerived: AppDerivedData;
}

/**
 * useAppShell — toda la lógica de estado de AuthenticatedShell.
 *
 * Extrae:
 * - 8 useState de UI (modales, overlays, flags)
 * - 5 useCollection de Firestore
 * - 4 useEffect (theme-color, título, SW, notificaciones)
 * - 5 useMemo de datos derivados
 * - handleTabClick y handleLogout
 *
 * El componente AuthenticatedShell queda como renderizador puro.
 */
export function useAppShell(user: User, onLogout: () => void): AppShellState {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const swRef = useServiceWorker();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── UI state ───────────────────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

  // ── Colecciones Firestore ──────────────────────────────────────────
  const paneles = useCollection<Panel>("paneles");
  const clientes = useCollection<Cliente>("clientes");
  const contratos = useCollection<Contrato>("contratos");
  const gastos = useCollection<Gasto>("gastos");
  const proveedores = useCollection<Proveedor>("proveedores");

  const loading = paneles.loading || contratos.loading;
  const error =
    paneles.error ?? clientes.error ?? contratos.error ?? gastos.error ?? proveedores.error;

  // ── Datos derivados ────────────────────────────────────────────────
  const contractsActive = useMemo(() => contratos.data.filter(x => !x.deleted), [contratos.data]);
  const clientesActive = useMemo(() => clientes.data.filter(x => !x.deleted), [clientes.data]);
  const proveedoresActive = useMemo(
    () => proveedores.data.filter(x => !x.deleted),
    [proveedores.data],
  );
  const trashCount = useMemo(() => contratos.data.filter(x => x.deleted).length, [contratos.data]);
  const notifCount = useMemo(() => {
    if (!contractsActive.length) return 0;
    const hoy = new Date();
    const proxVencer = contractsActive.filter(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoy.getTime()) / 86_400_000);
      return d > 0 && d <= 30;
    }).length;
    const sinPagar = contractsActive.filter(c => !c.pagado && c.monto > 0).length;
    return proxVencer + sinPagar;
  }, [contractsActive]);

  // ── Datos del usuario ──────────────────────────────────────────────
  const userName = useMemo(() => {
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

  // ── Header color ───────────────────────────────────────────────────
  const headerColor = showProfile ? T.bg : (HEADER_COLORS[location.pathname] ?? T.bg);
  const headerDark = headerColor !== T.bg;

  // ── theme-color meta tag ───────────────────────────────────────────
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", headerColor);
    document.documentElement.style.background = headerColor;
    document.body.style.background = headerColor;
    document.documentElement.style.setProperty("--app-bg", headerColor);
  }, [headerColor]);

  // ── Título del documento ───────────────────────────────────────────
  useEffect(() => {
    const section = showProfile ? "Perfil" : (TAB_TITLES[location.pathname] ?? "Vista360");
    document.title = `${section} | Vista360`;
  }, [location.pathname, showProfile]);

  // ── Push notifications de vencimiento ─────────────────────────────
  useNotifications({
    contractsActive,
    paneles: paneles.data,
    clientesActive,
    swRef,
  });

  // ── Navegación con scroll-to-top ───────────────────────────────────
  const handleTabClick = useCallback(
    (path: string) => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      if (path === "/perfil") {
        setShowProfile(true);
      } else {
        setShowProfile(false);
        navigate(path);
      }
    },
    [navigate],
  );

  // ── Logout ─────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setShowProfile(false);
    setConfirmLogout(false);
    onLogout();
  }, [onLogout]);

  // ── AppContext values ──────────────────────────────────────────────
  const appData: AppData = useMemo(
    () => ({
      paneles: paneles.data,
      clientes: clientes.data,
      contratos: contratos.data,
      gastos: gastos.data,
      proveedores: proveedores.data,
      loading,
      error,
    }),
    [paneles.data, clientes.data, contratos.data, gastos.data, proveedores.data, loading, error],
  );

  const appSetters: AppSetters = useMemo(
    () => ({
      setPaneles: paneles.setData,
      setClientes: clientes.setData,
      setContratos: contratos.setData,
      setGastos: gastos.setData,
      setProveedores: proveedores.setData,
    }),
    [paneles.setData, clientes.setData, contratos.setData, gastos.setData, proveedores.setData],
  );

  const appDerived: AppDerivedData = useMemo(
    () => ({ contractsActive, clientesActive, proveedoresActive, trashCount, notifCount }),
    [contractsActive, clientesActive, proveedoresActive, trashCount, notifCount],
  );

  return {
    showProfile,
    setShowProfile,
    drawerOpen,
    setDrawerOpen,
    trashOpen,
    setTrashOpen,
    autoScan,
    setAutoScan,
    globalSearch,
    setGlobalSearch,
    notifOpen,
    setNotifOpen,
    confirmLogout,
    setConfirmLogout,
    anyModalOpen,
    setAnyModalOpen,
    scrollRef,
    isOnline,
    headerColor,
    headerDark,
    userName,
    userInitials,
    notifCount,
    trashCount,
    handleTabClick,
    handleLogout,
    appData,
    appSetters,
    appDerived,
  };
}
