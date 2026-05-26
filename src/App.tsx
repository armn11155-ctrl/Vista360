import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
  Component,
} from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "./config/firebase";
import { T } from "./config/theme";
import { ALLOWED_EMAILS, BOTTOM_TABS_LIST, NAV_TAB_IDS } from "./config/constants";
import { ToastProvider } from "./context/UIContext";
import { AppProvider } from "./context/AppContext";
import type { AppDerivedData } from "./context/AppContext";
import type { AppData, AppSetters } from "./types";
import { useCollection } from "./hooks/useCollection";
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "./types";
import { useViewportSetup } from "./hooks/useViewportSetup";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

// ── Componentes extraídos ─────────────────────────────────────────
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { TabSuspense, SkDarkCard } from "./components/shared/AppSkeletons";
import { BTM_ICONS } from "./components/layout/BottomTabIcons";
import { ProfileView } from "./components/features/profile/ProfileView";

// ── Carga eager (crítica para el primer render) ───────────────────
import Splash from "./pages/Splash";
import LoginScreen from "./components/features/auth/LoginScreen";
import { OfflineBanner } from "./components/ui";
import DrawerMenu from "./components/layout/DrawerMenu";
import NotifPanel from "./components/shared/NotifPanel";
import BusquedaGlobal from "./components/shared/BusquedaGlobal";
import TrashModal from "./components/shared/TrashModal";

// ── CSS Module ────────────────────────────────────────────────────
import styles from "./App.module.css";

// ── Carga lazy (code splitting por ruta) ─────────────────────────
const ResumenNuevo = lazy(() => import("./components/features/dashboard/ResumenNuevo"));
const Paneles = lazy(() => import("./components/features/paneles/Paneles"));
const Contratos = lazy(() => import("./components/features/contratos/Contratos"));
const Historico = lazy(() => import("./components/features/historico/Historico"));
const CRM = lazy(() => import("./components/features/crm/CRM"));
const Gastos = lazy(() => import("./components/features/gastos/Gastos"));
const Proveedores = lazy(() => import("./components/features/proveedores/Proveedores"));
const Facturacion = lazy(() => import("./components/features/facturacion/Facturacion"));
const Reportes = lazy(() => import("./components/features/reportes/Reportes"));
const Capital = lazy(() => import("./components/features/capital/Capital"));
const Mapa = lazy(() => import("./components/features/mapa/Mapa"));

/**
 * Prefetch de todos los chunks de pestañas en segundo plano.
 * Se llama una vez que el usuario está autenticado.
 * El browser descarga y cachea cada módulo mientras el usuario
 * ve la primera pestaña — al cambiar de pestaña ya está en memoria.
 */
function prefetchAllTabs() {
  // requestIdleCallback asegura que no compite con el primer render
  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 200);

  schedule(() => {
    import("./components/features/paneles/Paneles");
    import("./components/features/contratos/Contratos");
    import("./components/features/crm/CRM");
    import("./components/features/gastos/Gastos");
    import("./components/features/proveedores/Proveedores");
    import("./components/features/facturacion/Facturacion");
    import("./components/features/reportes/Reportes");
    import("./components/features/historico/Historico");
    import("./components/features/capital/Capital");
    import("./components/features/mapa/Mapa");
  });
}

// ── Color del header según ruta ───────────────────────────────────
const HEADER_COLORS: Record<string, string> = {
  "/": "#0E1A3B",
  "/capital": "#0E1A3B",
  "/contratos": "#0E1A3B",
  "/historico": "#0A0F1A",
  "/crm": T.accent,
  "/mapa": "#070D1C",
};

const TAB_TITLES: Record<string, string> = {
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

// ══════════════════════════════════════════════════════════════════
// AUTHENTICATED SHELL — se monta solo cuando user != null
// Aquí viven los useCollection hooks (requieren auth activa)
// ══════════════════════════════════════════════════════════════════
interface AuthenticatedShellProps {
  user: User;
  onLogout: () => void;
}

function AuthenticatedShell({ user, onLogout }: AuthenticatedShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();

  // ── UI state ──────────────────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Colecciones Firestore — via hook genérico ─────────────────────
  const paneles = useCollection<Panel>("paneles");
  const clientes = useCollection<Cliente>("clientes");
  const contratos = useCollection<Contrato>("contratos");
  const gastos = useCollection<Gasto>("gastos");
  const proveedores = useCollection<Proveedor>("proveedores");

  const loading =
    paneles.loading ||
    clientes.loading ||
    contratos.loading ||
    gastos.loading ||
    proveedores.loading;
  const error =
    paneles.error ?? clientes.error ?? contratos.error ?? gastos.error ?? proveedores.error;

  // ── Derived data ──────────────────────────────────────────────────
  const contractsActive = useMemo(() => contratos.data.filter(x => !x.deleted), [contratos.data]);
  const clientesActive = useMemo(() => clientes.data.filter(x => !x.deleted), [clientes.data]);
  const proveedoresActive = useMemo(
    () => proveedores.data.filter(x => !x.deleted),
    [proveedores.data],
  );
  const trashCount = useMemo(() => contratos.data.filter(x => x.deleted).length, [contratos.data]);

  const notifCount = useMemo(() => {
    if (!contractsActive.length) return 0;
    const hoyD = new Date();
    const proxVencer = contractsActive.filter(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000);
      return d > 0 && d <= 30;
    }).length;
    const sinPagar = contractsActive.filter(c => !c.pagado && c.monto > 0).length;
    return proxVencer + sinPagar;
  }, [contractsActive]);

  // ── Datos del usuario ─────────────────────────────────────────────
  const userName = useMemo(() => {
    if (user.displayName) return user.displayName;
    const local = (user.email ?? "").split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user]);

  const userInitials = useMemo(() => {
    if (!userName) return "?";
    const parts = userName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [userName]);

  // ── Header color ──────────────────────────────────────────────────
  const headerColor = showProfile ? T.bg : (HEADER_COLORS[location.pathname] ?? T.bg);
  const headerDark = headerColor !== T.bg;

  // ── theme-color meta tag ──────────────────────────────────────────
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

  // ── Título del documento ──────────────────────────────────────────
  useEffect(() => {
    const section = showProfile ? "Perfil" : (TAB_TITLES[location.pathname] ?? "Vista360");
    document.title = `${section} | Vista360`;
  }, [location.pathname, showProfile]);

  // ── Service Worker — Cache-First para assets, Network-First para navegación ──
  // El SW está activo y es esencial para el funcionamiento offline de la PWA.
  // Ver /public/sw.js para la implementación completa de estrategias de caché.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(reg => {
        swRef.current = reg;
        // Forzar actualización si hay una nueva versión esperando
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          newSW?.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // Nueva versión disponible — se aplicará en el próximo reload
              console.info("[SW] Nueva versión disponible. Recarga para actualizar.");
            }
          });
        });
      })
      .catch(err => console.warn("[SW] Registro fallido:", err));
  }, []);

  // ── Notificaciones de vencimiento ─────────────────────────────────
  useEffect(() => {
    if (!contractsActive.length || !paneles.data.length || !clientesActive.length) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const hoyD = new Date();
    let enviadas: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem("v360_notif");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean | { ts: number; val: boolean }>;
        // TTL cleanup: eliminar entradas con más de 90 días
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const cleaned: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(parsed)) {
          // Soporte para formato legacy (boolean puro) y nuevo (objeto con ts)
          if (typeof v === "boolean") {
            // Mantener claves cuyo contrato aún existe (id presente en contractsActive)
            const cid = k.split("_")[0];
            if (contractsActive.some(c => c.id === cid)) cleaned[k] = v;
          } else if (typeof v === "object" && v !== null && (v as { ts: number }).ts > cutoff) {
            cleaned[k] = (v as { ts: number; val: boolean }).val;
          }
        }
        enviadas = cleaned;
        // Guardar versión limpia inmediatamente
        localStorage.setItem("v360_notif", JSON.stringify(cleaned));
      }
    } catch {
      /* ignored */
    }

    contractsActive.forEach(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000);
      [30, 15].forEach(umbral => {
        if (d <= 0 || d > umbral) return;
        const key = `${c.id}_${umbral}`;
        if (enviadas[key]) return;
        const panel = paneles.data.find(p => p.id === c.panel_id);
        const cliente = clientesActive.find(cl => cl.id === c.cliente_id);
        if (!panel || !cliente) return;
        const titulo =
          d <= 5
            ? ` Vence en ${d} día${d === 1 ? "" : "s"} — ${panel.nombre}`
            : ` Vence en ${d} días — ${panel.nombre}`;
        const cuerpo = `Cliente: ${cliente.empresa} · ${c.monto}/mes`;
        try {
          if (swRef.current?.showNotification) {
            swRef.current.showNotification(titulo, {
              body: cuerpo,
              tag: key,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              ...({ vibrate: [200, 100, 200] } as Record<string, unknown>),
              requireInteraction: d <= 5,
            });
          } else {
            new Notification(titulo, { body: cuerpo, tag: key });
          }
          enviadas[key] = true;
        } catch {
          /* ignored */
        }
      });
    });
    try {
      // Guardar con TTL: guardar como objeto simple (compatible con cleanup TTL)
      localStorage.setItem("v360_notif", JSON.stringify(enviadas));
    } catch {
      /* ignored */
    }
  }, [contractsActive, paneles.data, clientesActive]);

  // ── Navegación ────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AppProvider data={appData} setters={appSetters} derived={appDerived}>
      {!isOnline && <OfflineBanner />}
      <div className={styles.appRoot} style={{ background: T.bg, color: T.text }}>
        {/* ── TOP NAV ── */}
        <nav
          aria-label="Encabezado principal"
          style={{
            flexShrink: 0,
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 12,
            background: headerColor,
            borderBottom: headerDark ? "none" : `1px solid rgba(229,231,235,0.8)`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: headerDark ? "rgba(255,255,255,0.10)" : T.text,
              border: headerDark ? "1px solid rgba(255,255,255,0.14)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: headerDark ? "none" : "0 4px 12px rgba(15,23,41,0.18)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="white" />
              <rect x="13" y="3" width="8" height="8" rx="2" fill="white" />
              <rect x="3" y="13" width="8" height="8" rx="2" fill="white" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="white" />
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: headerDark ? "#fff" : T.text,
                lineHeight: 1.1,
              }}
            >
              {showProfile ? "Perfil" : (TAB_TITLES[location.pathname] ?? "Vista360")}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Search */}
            <button
              onClick={() => setGlobalSearch(true)}
              aria-label="Buscar"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
                border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path
                  d="M21 21L15 15M17 11C17 14.866 13.866 18 10 18C6.134 18 3 14.866 3 11C3 7.134 6.134 4 10 4C13.866 4 17 7.134 17 11Z"
                  stroke={headerDark ? "#fff" : T.text}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotifOpen(v => !v)}
              aria-label="Notificaciones"
              aria-expanded={notifOpen}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
                border: headerDark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24">
                <path
                  d="M15 17H9M15 17C15 18.657 13.657 20 12 20C10.343 20 9 18.657 9 17M15 17H20L18.784 15.784C18.284 15.284 18 14.612 18 13.914V10C18 7.239 15.761 5 13 5H11C8.239 5 6 7.239 6 10V13.914C6 14.612 5.716 15.284 5.216 15.784L4 17H9"
                  stroke={headerDark ? "#fff" : T.text}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {notifCount > 0 && (
                <div
                  aria-label={`${notifCount} notificaciones`}
                  style={{
                    position: "absolute",
                    top: 7,
                    right: 7,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: T.red,
                    border: `2px solid ${T.white}`,
                  }}
                />
              )}
            </button>

            {/* Avatar */}
            <button
              onClick={() => handleTabClick("/perfil")}
              aria-label="Ver perfil"
              aria-current={showProfile ? "page" : undefined}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2A5BD9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                border: showProfile ? `2px solid ${T.accent}` : "2px solid transparent",
                boxShadow: "0 4px 12px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                letterSpacing: "0.5px",
              }}
            >
              {userInitials}
            </button>
          </div>
        </nav>

        {/* ── CONTENIDO ── */}
        <main
          ref={scrollRef}
          data-scroll
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            overscrollBehavior: "none",
            touchAction: "pan-y",
            background: showProfile
              ? "#ffffff"
              : ["contratos", "capital"].some(s => location.pathname.includes(s))
                ? "#0E1A3B"
                : location.pathname === "/mapa"
                  ? "#070D1C"
                  : T.bg,
            position: "relative",
          }}
        >
          {loading ? (
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
              {[1, 2, 3, 4].map(i => (
                <SkDarkCard key={i} />
              ))}
            </div>
          ) : showProfile ? (
            <ProfileView
              user={user}
              userName={userName}
              gastos={gastos.data}
              confirmLogout={confirmLogout}
              setConfirmLogout={setConfirmLogout}
              onLogout={async () => {
                await signOut(auth);
                setShowProfile(false);
                setConfirmLogout(false);
                onLogout();
              }}
            />
          ) : (
            <Suspense fallback={<TabSuspense />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      {error && (
                        <div className={styles.firebaseError}>
                          <span style={{ fontSize: 22 }}></span>
                          <div>
                            <div style={{ fontWeight: 700, color: T.amber, fontSize: 14 }}>
                              Sin conexión a Firebase
                            </div>
                            <div style={{ fontSize: 12, color: T.muted }}>
                              Despliega en Cloudflare para conectar.
                            </div>
                          </div>
                        </div>
                      )}
                      <ErrorBoundary label="Inicio">
                        <ResumenNuevo
                          clientes={clientesActive}
                          contratos={contratos.data}
                          paneles={paneles.data}
                          gastos={gastos.data}
                          setTab={(id: string) => navigate(`/${id === "hoy" ? "" : id}`)}
                          userName={userName}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/paneles"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Paneles">
                        <Paneles
                          paneles={paneles.data}
                          setPaneles={paneles.setData}
                          contratos={contratos.data}
                          loading={loading}
                          setTab={(id: string) => navigate(`/${id}`)}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/contratos"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabFlush}`}>
                      <ErrorBoundary label="Contratos">
                        <Contratos
                          contratos={contratos.data}
                          setContratos={contratos.setData}
                          paneles={paneles.data}
                          clientes={clientesActive}
                          loading={loading}
                          setTab={(id: string) => navigate(`/${id}`)}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/historico"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Histórico">
                        <Historico
                          contratos={contractsActive}
                          setContratos={contratos.setData}
                          paneles={paneles.data}
                          clientes={clientesActive}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/crm"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="CRM">
                        <CRM
                          clientes={clientesActive}
                          setClientes={clientes.setData}
                          contratos={contractsActive}
                          loading={loading}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/gastos"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Gastos">
                        <Gastos
                          gastos={gastos.data}
                          setGastos={gastos.setData}
                          autoScan={autoScan}
                          setAutoScan={setAutoScan}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/proveedores"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Proveedores">
                        <Proveedores
                          proveedores={proveedoresActive}
                          setProveedores={proveedores.setData}
                          loading={loading}
                          onModalChange={setAnyModalOpen}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/facturacion"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Facturación">
                        <Facturacion
                          contratos={contractsActive}
                          paneles={paneles.data}
                          clientes={clientesActive}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/resultados"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Resultados">
                        <Reportes
                          contratos={contractsActive}
                          paneles={paneles.data}
                          clientes={clientesActive}
                          gastos={gastos.data}
                          initialSeccion="resultados"
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/reportes"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabPadded}`}>
                      <ErrorBoundary label="Reportes">
                        <Reportes
                          contratos={contractsActive}
                          paneles={paneles.data}
                          clientes={clientesActive}
                          gastos={gastos.data}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/capital"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabFlush}`}>
                      <ErrorBoundary label="Capital">
                        <Capital
                          paneles={paneles.data}
                          contratos={contractsActive}
                          gastos={gastos.data}
                          proveedores={proveedoresActive}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
                <Route
                  path="/mapa"
                  element={
                    <div className={`${styles.tabPanel} ${styles.tabFlush}`}>
                      <ErrorBoundary label="Mapa">
                        <Mapa
                          paneles={paneles.data}
                          clientes={clientesActive}
                          contratos={contractsActive}
                        />
                      </ErrorBoundary>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          )}
        </main>

        {/* ── BOTTOM TAB BAR ── */}
        {!anyModalOpen && (
          <div
            style={{
              position: "fixed",
              bottom: "calc(env(safe-area-inset-bottom) + 4px)",
              left: 12,
              right: 12,
              zIndex: 100,
              pointerEvents: "none",
            }}
          >
            <div
              role="tablist"
              aria-label="Navegación principal"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 6px",
                maxWidth: 480,
                margin: "0 auto",
                pointerEvents: "auto",
                background: T.white,
                border: "1px solid rgba(229,231,235,0.9)",
                borderRadius: 28,
                boxShadow: "0 8px 28px rgba(15,23,41,0.14), 0 2px 8px rgba(15,23,41,0.06)",
              }}
            >
              {BOTTOM_TABS_LIST.map(t => {
                if (t.id === "__add__")
                  return (
                    <div key="add" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                      <button
                        aria-label="Registrar gasto rápido"
                        onClick={() => {
                          setAutoScan(true);
                          navigate("/gastos");
                        }}
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: "50%",
                          background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
                          border: "3px solid rgba(255,255,255,0.95)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow:
                            "0 8px 24px rgba(37,99,235,0.42), 0 2px 8px rgba(37,99,235,0.2)",
                          marginTop: -28,
                        }}
                      >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                          <path
                            d="M12 5V19M5 12H19"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  );

                const routePath = t.id === "hoy" ? "/" : `/${t.id}`;
                const active = !showProfile && location.pathname === routePath;

                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    aria-label={t.label}
                    tabIndex={active ? 0 : -1}
                    onClick={() => {
                      setShowProfile(false);
                      navigate(routePath);
                    }}
                    onKeyDown={e => {
                      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                      e.preventDefault();
                      const idx = NAV_TAB_IDS.indexOf(t.id);
                      if (idx === -1) return;
                      const next =
                        e.key === "ArrowRight"
                          ? NAV_TAB_IDS[(idx + 1) % NAV_TAB_IDS.length]
                          : NAV_TAB_IDS[(idx - 1 + NAV_TAB_IDS.length) % NAV_TAB_IDS.length];
                      navigate(next === "hoy" ? "/" : `/${next}`);
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      background: active ? "rgba(37,99,235,0.08)" : "none",
                      border: "none",
                      color: active ? T.accent : "#9CA3AF",
                      padding: "6px 4px",
                      minHeight: 48,
                      borderRadius: 18,
                      margin: "0 2px",
                      transition: "background 0.18s ease, color 0.18s ease",
                    }}
                  >
                    <div
                      style={{
                        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
                        transform: active ? "scale(1.12)" : "scale(1)",
                      }}
                    >
                      {BTM_ICONS[t.id]}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: active ? 700 : 500,
                        letterSpacing: active ? "0.01em" : 0,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OVERLAYS ── */}
        <NotifPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          contratos={contratos.data}
          clientes={clientesActive}
          paneles={paneles.data}
          gastos={gastos.data}
        />
        <BusquedaGlobal
          open={globalSearch}
          onClose={() => setGlobalSearch(false)}
          paneles={paneles.data}
          clientes={clientesActive}
          contratos={contratos.data}
          onNavigate={(id: string) => navigate(id === "hoy" ? "/" : `/${id}`)}
        />
        <DrawerMenu
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={showProfile ? "perfil" : location.pathname.replace("/", "") || "hoy"}
          onTabClick={handleTabClick}
          onTrashOpen={() => setTrashOpen(true)}
          trashCount={trashCount}
          userName={userName}
          userInitials={userInitials}
        />
        <TrashModal
          open={trashOpen}
          onClose={() => setTrashOpen(false)}
          contratos={contratos.data}
          clientes={clientes.data}
          paneles={paneles.data}
          proveedores={proveedores.data}
          setContratos={contratos.setData}
          setClientes={clientes.setData}
          setPaneles={paneles.setData}
          setProveedores={proveedores.setData}
        />
      </div>
    </AppProvider>
  );
}

// ── Visible error boundary for AuthenticatedShell ─────────────────
class ShellErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#0E1A3B",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "monospace",
            zIndex: 9999,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}></div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#FF6B6B" }}>
            Error al cargar la app
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
              maxWidth: 380,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.split("\n").slice(0, 5).join("\n")}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ══════════════════════════════════════════════════════════════════
// APP SHELL — gestiona splash y auth; monta AuthenticatedShell
//             solo cuando el usuario está confirmado
// ══════════════════════════════════════════════════════════════════
function AppShell() {
  useViewportSetup();

  const [splash, setSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // ── iOS Safari: fijar scroll del documento ──────────────────────
  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0 || window.pageYOffset !== 0) window.scrollTo(0, 0);
    };
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    lockScroll();
    window.addEventListener("scroll", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", lockScroll, { passive: true });
    window.addEventListener("resize", lockScroll, { passive: true });
    return () => {
      document.removeEventListener("touchstart", noop);
      window.removeEventListener("scroll", lockScroll);
      window.removeEventListener("resize", lockScroll);
      window.visualViewport?.removeEventListener("resize", lockScroll);
      window.visualViewport?.removeEventListener("scroll", lockScroll);
    };
  }, []);

  // ── Firebase Auth ────────────────────────────────────────────────
  useEffect(() => {
    const fallback = setTimeout(() => setAuthReady(true), 5000);
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        u => {
          clearTimeout(fallback);
          if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email ?? "")) {
            signOut(auth);
            setUser(null);
          } else {
            setUser(u);
            // Prefetch todos los chunks de pestañas mientras el usuario ve la primera tab
            prefetchAllTabs();
            if (u && "Notification" in window && Notification.permission === "default") {
              Notification.requestPermission().catch(() => {});
            }
          }
          setAuthReady(true);
        },
        err => {
          console.error("[Auth] error:", err);
          clearTimeout(fallback);
          setAuthReady(true);
        },
      );
    } catch (err) {
      console.error("[Auth] Firebase init error:", err);
      clearTimeout(fallback);
      setAuthReady(true);
    }
    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, []);

  return (
    <ToastProvider>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#F2F4F8;-webkit-text-size-adjust:100%}
        body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;background:transparent}
        button,a,select,[role='button'],[role='tab'],[role='menuitem'],[role='option']{touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent;font-family:inherit}
        button:active{opacity:0.78;transform:scale(0.96)}
        input,select,textarea{-webkit-appearance:none;appearance:none;font-size:16px!important;scroll-margin-bottom:180px;touch-action:manipulation}
        input,textarea{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
        ::-webkit-scrollbar{display:none}
        [data-scroll]{overscroll-behavior:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes skPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{from{opacity:.2}to{opacity:.6}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
      `}</style>

      {splash && <Splash done={() => setSplash(false)} />}
      {!splash && authReady && !user && <LoginScreen onLoginSuccess={(u: User) => setUser(u)} />}
      {!splash && !!user && (
        <ShellErrorBoundary>
          <AuthenticatedShell user={user} onLogout={() => setUser(null)} />
        </ShellErrorBoundary>
      )}
    </ToastProvider>
  );
}

// ── Root export ───────────────────────────────────────────────────
export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
