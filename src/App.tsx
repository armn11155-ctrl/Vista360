// @ts-nocheck — legacy file: migrating to strict TypeScript gradually
import React, { useState, useMemo, useEffect, useCallback, useRef, Component } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

// ── Tipos ─────────────────────────────────────────────────────────
import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "./types";

// ── Config / Firebase ─────────────────────────────────────────────
import { auth } from "./config/firebase";
import { T } from "./config/theme";
import { ALLOWED_EMAILS, BOTTOM_TABS_LIST, NAV_TAB_IDS } from "./config/constants";

// ── Servicios y utilidades ────────────────────────────────────────
import { fb } from "./services/firestore";
import { ToastProvider } from "./context/UIContext";
import { useViewportSetup } from "./hooks/useViewportSetup";

// ── Componentes de features ────────────────────────────────────────
import Splash from "./pages/Splash";
import LoginScreen from "./components/features/auth/LoginScreen";
import ResumenNuevo from "./components/features/dashboard/ResumenNuevo";
import Paneles from "./components/features/paneles/Paneles";
import Contratos from "./components/features/contratos/Contratos";
import Historico from "./components/features/historico/Historico";
import CRM from "./components/features/crm/CRM";
import Gastos from "./components/features/gastos/Gastos";
import Proveedores from "./components/features/proveedores/Proveedores";
import Facturacion from "./components/features/facturacion/Facturacion";
import Reportes from "./components/features/reportes/Reportes";
import Capital from "./components/features/capital/Capital";
import Mapa from "./components/features/mapa/Mapa";
import NotifPanel from "./components/shared/NotifPanel";
import DrawerMenu from "./components/layout/DrawerMenu";
import BusquedaGlobal from "./components/shared/BusquedaGlobal";
import TrashModal from "./components/shared/TrashModal";

// ── UI primitivos ─────────────────────────────────────────────────
import { OfflineBanner } from "./components/ui";

// ── BTM_ICONS: iconos del bottom tab bar ─────────────────────────
const BTM_ICONS: Record<string, React.ReactNode> = {
  hoy: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.552 5.448 21 6 21H9M19 10L21 12M19 10V20C19 20.552 18.552 21 18 21H15M9 21V15C9 14.448 9.448 14 10 14H14C14.552 14 15 14.448 15 15V21M9 21H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  paneles: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  contratos: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 12H15M9 16H15M17 21H7C5.895 21 5 20.105 5 19V5C5 3.895 5.895 3 7 3H14L19 8V19C19 20.105 18.105 21 17 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  crm: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        d="M17 21V19C17 17.343 15.657 16 14 16H10C8.343 16 7 17.343 7 19V21M12 13C14.209 13 16 11.209 16 9C16 6.791 14.209 5 12 5C9.791 5 8 6.791 8 9C8 11.209 9.791 13 12 13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// ── ErrorBoundary ─────────────────────────────────────────────────
interface EBState {
  hasError: boolean;
  msg: string;
}
class ErrorBoundary extends Component<{ label: string; children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, msg: "" };
  static getDerivedStateFromError(e: Error): EBState {
    return { hasError: true, msg: e.message };
  }
  render() {
    if (this.state.hasError)
      return (
        <div style={{ padding: 20, color: T.red, fontSize: 13 }}>
          [{this.props.label}] Error: {this.state.msg}
        </div>
      );
    return this.props.children;
  }
}

// ── SkDarkCard: skeleton de carga para el estado inicial ──────────
function SkDarkCard() {
  return (
    <div
      style={{
        background: "#1A2744",
        borderRadius: 16,
        padding: "18px 16px",
        marginBottom: 12,
        animation: "skPulse 1.6s ease-in-out infinite",
        backgroundSize: "200% 100%",
        backgroundImage: "linear-gradient(90deg,#1A2744 25%,#243059 50%,#1A2744 75%)",
      }}
    >
      <div
        style={{
          height: 12,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 6,
          width: "60%",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          height: 28,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
          width: "40%",
          marginBottom: 8,
        }}
      />
      <div
        style={{ height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 6, width: "80%" }}
      />
    </div>
  );
}

// ── FirebaseStatus: resumen de datos en la pantalla de perfil ─────
function FirebaseStatus({
  contratos,
  paneles,
  clientes,
  gastos,
  fbConnected,
  fbLoading,
  fbError,
}: {
  contratos: Contrato[];
  paneles: Panel[];
  clientes: Cliente[];
  gastos: Gasto[];
  fbConnected: boolean;
  fbLoading: boolean;
  fbError: boolean;
}) {
  const statusColor = fbError ? T.red : fbLoading ? T.amber : "#22C55E";
  const statusText = fbError ? "Error" : fbLoading ? "Conectando…" : "Conectado";
  return (
    <div
      style={{
        background: "#0E1835",
        borderRadius: 16,
        padding: 16,
        border: "1px solid rgba(59,110,248,0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Firebase · {statusText}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Contratos", value: contratos.length },
          { label: "Paneles", value: paneles.length },
          { label: "Clientes", value: clientes.length },
          { label: "Gastos", value: gastos.length },
        ].map(item => (
          <div
            key={item.label}
            style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getHeaderColor(t: string, profile: boolean): string {
  if (profile) return T.bg;
  if (t === "hoy" || t === "capital" || t === "contratos") return "#0E1A3B";
  if (t === "historico") return "#0A0F1A";
  if (t === "crm") return T.accent;
  if (t === "mapa") return "#070D1C";
  return T.bg;
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT — nuevo diseño + lógica Firebase original
// ══════════════════════════════════════════════════════════════════
export default function App() {
  // Configura meta viewport / apple-web-app en el <head> al montar.
  // Antes era un IIFE; ahora es un hook declarativo y testeable.
  useViewportSetup();

  const [splash, setSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null); // Firebase Auth user
  const [authReady, setAuthReady] = useState(false); // true cuando ya sabemos si hay sesión o no
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState("hoy");

  const headerColor = getHeaderColor(tab, showProfile);
  const headerDark = headerColor !== T.bg;
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const color = splash ? T.dark : headerColor;
    meta.setAttribute("content", color);
    document.documentElement.style.background = color;
    document.body.style.background = color;
    document.documentElement.style.setProperty("--app-bg", color);
  }, [headerColor, splash]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paneles, setPaneles] = useState<Panel[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── iOS SAFARI: FIJAR SCROLL DEL DOCUMENTO ──────────────────────
  // PROBLEMA: cuando Safari muestra/oculta su barra inferior, hace scroll
  // del documento (scrollY > 0). Los toques se reportan con offset del scroll
  // pero los elementos position:fixed están en coords del viewport → DESFASE.
  // SOLUCIÓN: forzar scrollY=0 siempre que el documento se mueva.
  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };

    // TRUCO PWA iOS: listener de touchstart en el documento hace que WKWebView
    // reconozca todos los elementos como tocables → click events funcionan
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });

    // Ejecutar de inmediato
    lockScroll();

    // Escuchar scroll del documento y cambios del viewport
    window.addEventListener("scroll", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", lockScroll, { passive: true });
    window.addEventListener("resize", lockScroll, { passive: true });

    // Navegación global desde componentes internos (ej: "Ver todas" en ActividadReciente)
    const handleNav = (e: Event) => {
      setTab((e as CustomEvent<string>).detail);
    };
    window.addEventListener("vista360_nav", handleNav);

    return () => {
      document.removeEventListener("touchstart", noop);
      window.removeEventListener("scroll", lockScroll);
      window.removeEventListener("resize", lockScroll);
      window.removeEventListener("vista360_nav", handleNav);
      window.visualViewport?.removeEventListener("resize", lockScroll);
      window.visualViewport?.removeEventListener("scroll", lockScroll);
    };
  }, []);

  // ── Auth: detectar usuario ya logueado al cargar ──
  useEffect(() => {
    // Timeout de seguridad: si Firebase no responde en 5 s (config ausente,
    // sin red, dominio no autorizado), forzamos authReady=true para que la
    // pantalla de login sea visible en lugar de quedar en blanco.
    const fallback = setTimeout(() => setAuthReady(true), 5000);

    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        u => {
          clearTimeout(fallback);
          // Whitelist check si el usuario ya estaba logueado y se restringe
          if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email ?? "")) {
            signOut(auth);
            setUser(null);
          } else {
            setUser(u);
            // ── Solicitar permiso de notificaciones al iniciar sesión ──
            // Solo si el navegador lo soporta y aún no se ha decidido.
            // No bloqueante: si el usuario cancela, todo sigue funcionando.
            if (u && "Notification" in window && Notification.permission === "default") {
              Notification.requestPermission().catch(() => {});
            }
          }
          setAuthReady(true);
        },
        err => {
          // Error de Firebase (dominio no autorizado, config inválida, etc.)
          console.error("[Auth] onAuthStateChanged error:", err);
          clearTimeout(fallback);
          setAuthReady(true); // Mostrar login aunque Firebase falle
        },
      );
    } catch (err) {
      // Firebase no inicializado correctamente (variables de entorno ausentes)
      console.error("[Auth] Firebase init error:", err);
      clearTimeout(fallback);
      setAuthReady(true);
    }

    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, []);

  // ── Service Worker + Web Push ────────────────────────────────────
  // El SW vive en /public/sw.js (raíz del dominio).
  // IMPORTANTE: un SW registrado desde blob: URL tiene scope null y
  // NO puede interceptar eventos fetch. El archivo real en /sw.js
  // sí puede, lo que habilita caché offline genuina + push remoto.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(reg => {
        swRef.current = reg;
      })
      .catch(err => console.warn("[SW] Registro fallido:", err));
  }, []);

  // ── Notificaciones de vencimiento ──
  useEffect(() => {
    if (!contratos.length || !paneles.length || !clientes.length) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const hoyD = new Date();
    let enviadas: Record<string, boolean> = {};
    try {
      enviadas = JSON.parse(localStorage.getItem("v360_notif") || "{}");
    } catch {
      /* localStorage bloqueado en modo privado — se ignora y se usan notifs vacías */
    }
    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin).getTime() - hoyD.getTime()) / 86400000);
      [30, 15].forEach(umbral => {
        if (d > 0 && d <= umbral) {
          const key = `${c.id}_${umbral}`;
          if (enviadas[key]) return;
          const panel = paneles.find(p => p.id === c.panel_id);
          const cliente = clientes.find(cl => cl.id === c.cliente_id);
          if (!panel || !cliente) return;
          const titulo =
            d <= 5
              ? `🚨 Vence en ${d} día${d === 1 ? "" : "s"} — ${panel.nombre}`
              : `⚠️ Vence en ${d} días — ${panel.nombre}`;
          const cuerpo = `Cliente: ${cliente.empresa} · ${fmt(c.monto)}/mes`;
          try {
            if (swRef.current?.showNotification) {
              swRef.current.showNotification(titulo, {
                body: cuerpo,
                tag: key,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                vibrate: [200, 100, 200],
                requireInteraction: d <= 5,
              });
            } else {
              new Notification(titulo, { body: cuerpo, tag: key });
            }
            enviadas[key] = true;
          } catch {
            /* Notification() puede lanzar en algunos browsers por permisos */
          }
        }
      });
    });
    try {
      localStorage.setItem("v360_notif", JSON.stringify(enviadas));
    } catch {
      /* localStorage lleno o bloqueado — las notifs se reenviarán la próxima sesión */
    }
  }, [contratos, paneles, clientes]);

  // ── Carga de datos en TIEMPO REAL con onSnapshot ──
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null); // Resetear error anterior al reconectar

    // loaded: Set de colecciones que ya emitieron su primer evento (éxito o error).
    // Usar Set en lugar de un objeto mutable evita lecturas inconsistentes si dos
    // snapshots llegan en el mismo microtask — Set.add() + Set.size es atómico
    // dentro del event loop single-threaded de JS y no requiere leer propiedades
    // individuales que podrían estar en estados intermedios.
    const TOTAL_COLS = 5;
    const loaded = new Set<string>();
    const checkDone = (col: string) => {
      loaded.add(col);
      if (loaded.size >= TOTAL_COLS) setLoading(false);
    };

    const unsubs = [
      fb.subscribe<Cliente>(
        "clientes",
        items => {
          setClientes(items);
          setError(null);
          checkDone("clientes");
        },
        err => {
          console.error("[Snapshot] clientes:", err);
          setError((err as Error).message ?? "Error Firebase");
          checkDone("clientes");
        },
      ),
      fb.subscribe<Panel>(
        "paneles",
        items => {
          setPaneles(items);
          checkDone("paneles");
        },
        err => {
          console.error("[Snapshot] paneles:", err);
          setError((err as Error).message ?? "Error Firebase");
          checkDone("paneles");
        },
      ),
      fb.subscribe<Contrato>(
        "contratos",
        items => {
          setContratos(items);
          checkDone("contratos");
        },
        err => {
          console.error("[Snapshot] contratos:", err);
          setError((err as Error).message ?? "Error Firebase");
          checkDone("contratos");
        },
      ),
      fb.subscribe<Gasto>(
        "gastos",
        items => {
          setGastos(items);
          checkDone("gastos");
        },
        err => {
          console.error("[Snapshot] gastos:", err);
          setError((err as Error).message ?? "Error Firebase");
          checkDone("gastos");
        },
      ),
      fb.subscribe<Proveedor>(
        "proveedores",
        items => {
          setProveedores(items);
          checkDone("proveedores");
        },
        err => {
          console.error("[Snapshot] proveedores:", err);
          setError((err as Error).message ?? "Error Firebase");
          checkDone("proveedores");
        },
      ),
    ];

    return () => unsubs.forEach(u => u());
  }, [user]);

  const activeTab = showProfile ? "perfil" : tab;

  // ── Datos del usuario derivados del objeto Firebase Auth ────────
  // Se calculan una sola vez por render del App raíz.
  // userName: nombre real de Google. Si Google no tiene displayName,
  //   usa la parte local del email como fallback.
  // userInitials: hasta 2 iniciales (nombre + apellido). Se usan en
  //   el avatar del header y en el DrawerMenu.
  const userName = useMemo(() => {
    if (!user) return "";
    if (user.displayName) return user.displayName;
    // fallback: parte local del email con la primera letra en mayúscula
    const local = (user.email ?? "").split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [user]);

  const userInitials = useMemo(() => {
    if (!userName) return "?";
    const parts = userName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [userName]);

  const handleTabClick = useCallback((id: string) => {
    // Reset scroll to top instantly al cambiar de tab — se siente premium
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (id === "perfil") {
      setShowProfile(true);
      setTab("hoy");
    } else {
      setTab(id);
      setShowProfile(false);
    }
  }, []);

  // fechaCap: calculado UNA sola vez al montar. useRef garantiza que React
  // nunca descarte el valor (a diferencia de useMemo con deps vacías, que
  // puede ser invalidado por el scheduler en React 18+ concurrent mode).
  const fechaCapRef = useRef(
    (() => {
      const f = new Date().toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return f.charAt(0).toUpperCase() + f.slice(1);
    })(),
  );
  const fechaCap = fechaCapRef.current;

  // ── Título de la pestaña del navegador / barra de título en PWA ──
  // Ayuda a distinguir múltiples ventanas y mejora la experiencia en desktop.
  useEffect(() => {
    const TAB_TITLES: Record<string, string> = {
      hoy: "Inicio",
      paneles: "Paneles",
      contratos: "Contratos",
      historico: "Histórico",
      crm: "Clientes",
      resultados: "Resultados",
      reportes: "Reportes",
      gastos: "Gastos",
      proveedores: "Proveedores",
      facturacion: "Facturación",
      capital: "Capital",
      mapa: "Mapa",
    };
    const section = showProfile ? "Perfil" : (TAB_TITLES[tab] ?? "Vista360");
    document.title = `${section} | Vista360`;
  }, [tab, showProfile]);

  // ── Helpers de visibilidad + LAZY MOUNT ──────────────────────────
  // • show(): oculta/muestra con CSS — el estado local del tab sobrevive al cambio.
  // • lazyTab(): NO monta el componente hasta el primer foco.
  //   Ideal para tabs pesados (Mapa, Capital, Reportes, Facturación) que
  //   consumen recursos incluso cuando están ocultos. Una vez montados,
  //   quedan en memoria para no perder el estado al volver.
  const show = (id: string) => ({ display: activeTab === id ? undefined : "none" }) as const;

  // Registra qué tabs han sido visitados al menos una vez
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set(["hoy"]), // "hoy" se monta desde el inicio
  );
  // Actualiza el set al cambiar de tab
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);
  // Devuelve true solo si el tab ya fue visitado (o es el activo ahora)
  const lazyTab = (id: string) => visitedTabs.has(id) || activeTab === id;

  // ── Vistas filtradas — excluyen registros borrados (soft-delete) ──
  // useMemo garantiza que el .filter() solo corre cuando cambia el array
  // fuente, no en cada render del App raíz (que puede ocurrir por cualquier
  // cambio de estado: tab, modales, scroll, etc.).
  const contractsActive = useMemo(() => contratos.filter(x => !x.deleted), [contratos]);
  const clientesActive = useMemo(() => clientes.filter(x => !x.deleted), [clientes]);
  const proveedoresActive = useMemo(() => proveedores.filter(x => !x.deleted), [proveedores]);
  // trashCount: extrae el cálculo inline del JSX de DrawerMenu (evita array temporal en cada render)
  const trashCount = useMemo(() => contratos.filter(x => x.deleted).length, [contratos]);
  // notifCount: número de alertas para el badge del botón de campana.
  // Vencimientos próximos (≤30 días) + contratos sin pagar con monto > 0.
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

  return (
    <>
      {/* Fuentes y meta tags se inyectan en <head> desde useViewportSetup() */}
      <style>{`
        /* ── RESET BASE ── */
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}

        /* ── LAYOUT ── */
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#F2F4F8;-webkit-text-size-adjust:100%}
        body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;background:transparent}

        /* ── ELIMINAR DELAY DE 300ms EN iOS ──
           touch-action:manipulation solo en elementos interactivos (no en *)
           porque * puede interferir con el scroll en iOS PWA / WKWebView */
        button,a,select,
        [role='button'],[role='tab'],[role='menuitem'],[role='option']{
          touch-action:manipulation;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          font-family:inherit
        }
        button:active{opacity:0.78;transform:scale(0.96)}

        /* ── INPUTS ── */
        input,select,textarea{
          -webkit-appearance:none;appearance:none;
          font-size:16px!important;
          scroll-margin-bottom:180px;
          touch-action:manipulation
        }
        input,textarea{
          -webkit-user-select:text;user-select:text;
          -webkit-touch-callout:default
        }

        /* ── SCROLL ── */
        ::-webkit-scrollbar{display:none}
        [data-scroll]{overscroll-behavior:none}

        /* ── ANIMACIONES ── */
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes skPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{from{opacity:.2}to{opacity:.6}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeTab{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}

        /* ── ACCESIBILIDAD: respeta prefers-reduced-motion ──────────────
           Desactiva todas las animaciones/transiciones para usuarios con
           epilepsia fotosensible, vestibular disorders o preferencia de SO. */
        @media(prefers-reduced-motion:reduce){
          *,*::before,*::after{
            animation-duration:.01ms!important;
            animation-iteration-count:1!important;
            transition-duration:.01ms!important;
            scroll-behavior:auto!important
          }
        }

        /* ── TAB PANELS — siempre montados, visibilidad por CSS ────────
           v360-tab-panel es el wrapper de cada pestaña.
           display:none oculta sin desmontar → el estado local se conserva.
           El panel visible hereda el scroll del contenedor padre (#scroll-area). */
        .v360-tab-panel{width:100%;padding-bottom:calc(100px + env(safe-area-inset-bottom));animation:fadeTab .2s ease}
        /* Tabs con padding estándar (la mayoría) */
        .v360-tab-padded{padding-top:20px;padding-left:16px;padding-right:16px}
        /* Tabs sin padding: tienen cabecera de ancho completo (contratos, capital, mapa) */
        .v360-tab-flush{padding-top:0;padding-left:0;padding-right:0}

        /* ── LAYOUT PRINCIPAL DE LA APP ────────────────────────────── */
        .v360-app-root{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;overflow:hidden;overscroll-behavior:none}

        /* ── BOTÓN CERRAR SESIÓN (perfil) ─────────────────────────── */
        .v360-btn-logout{width:100%;padding:14px 18px;margin-bottom:24px;background:#FFFFFF;color:#EF4444;border:1px solid rgba(239,68,68,0.2);border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04);font-family:inherit}

        /* ── OVERLAY / MODAL DE CONFIRMACIÓN ──────────────────────── */
        .v360-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:600;display:flex;align-items:center;justify-content:center;padding:24px}
        .v360-confirm-box{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:320px;text-align:center}
        .v360-confirm-cancel{flex:1;padding:12px;background:transparent;border:1px solid #E5E7EB;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;touch-action:manipulation;color:#64748B;font-family:inherit}
        .v360-confirm-ok{flex:1;padding:12px;background:#EF4444;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;color:#fff;font-family:inherit}

        /* ── BANNER ERROR FIREBASE ─────────────────────────────────── */
        .v360-firebase-error{background:#FFF8EC;border:1px solid rgba(245,158,11,0.33);border-radius:14px;padding:16px;margin-bottom:20px;display:flex;gap:12px;align-items:center}
      `}</style>

      <ToastProvider>
        <OfflineBanner />
        {splash && <Splash done={() => setSplash(false)} />}

        {/* Pantalla de login: se muestra solo si no hay usuario y ya verificamos auth */}
        {!splash && authReady && !user && <LoginScreen onLoginSuccess={u => setUser(u)} />}

        {/* App principal: solo se muestra cuando hay sesión activa */}
        {!splash && !!user && (
          <div className="v360-app-root" style={{ background: T.bg, color: T.text }}>
            {/* ── TOP NAV ── */}
            <div
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
              {/* Botón menú */}
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Menú"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: headerDark ? "rgba(255,255,255,0.10)" : T.text,
                  border: headerDark ? "1px solid rgba(255,255,255,0.14)" : "none",
                  cursor: "pointer",
                  touchAction: "manipulation",
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

              {/* Título de sección + fecha */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: headerDark ? "#fff" : T.text,
                    lineHeight: 1.1,
                  }}
                >
                  {showProfile
                    ? "Perfil"
                    : {
                        hoy: "Inicio",
                        mapa: "Mapa",
                        capital: "Capital",
                        paneles: "Paneles",
                        contratos: "Contratos",
                        historico: "Histórico",
                        crm: "Clientes",
                        resultados: "Resultados",
                        reportes: "Reportes",
                        gastos: "Gastos",
                        proveedores: "Proveedores",
                        facturacion: "Facturación",
                      }[tab] || "Vista360"}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setGlobalSearch(true)}
                  aria-label="Buscar"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
                    border: headerDark
                      ? "1px solid rgba(255,255,255,0.14)"
                      : `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    touchAction: "manipulation",
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
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  aria-label="Notificaciones"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: headerDark ? "rgba(255,255,255,0.10)" : T.white,
                    border: headerDark
                      ? "1px solid rgba(255,255,255,0.14)"
                      : `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    touchAction: "manipulation",
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
                <button
                  onClick={() => handleTabClick("perfil")}
                  aria-label="Perfil"
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
                    cursor: "pointer",
                    touchAction: "manipulation",
                    boxShadow:
                      "0 4px 12px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                    letterSpacing: "0.5px",
                  }}
                >
                  {userInitials}
                </button>
              </div>
            </div>

            {/* ── CONTENIDO ── */}
            <div
              ref={scrollRef}
              data-scroll
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "scroll",
                overflowX: "hidden",
                overscrollBehavior: "none",
                touchAction: "pan-y",
                background:
                  activeTab === "contratos" || activeTab === "capital"
                    ? "#0E1A3B"
                    : activeTab === "mapa"
                      ? "#070D1C"
                      : T.bg,
                position: "relative",
              }}
            >
              {/* ── TAB PANELS ─────────────────────────────────────────────
               Todos los tabs se montan una sola vez al cargar datos.
               La visibilidad se controla con display:none para que cada
               tab conserve su estado local (filtros, scroll, formularios)
               al volver a él sin necesidad de re-fetch ni re-render.
               paddingTop/Left/Right varía según si el tab tiene cabecera propia. */}

              {loading ? (
                <div
                  style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 0 }}
                >
                  {[1, 2, 3, 4].map(i => (
                    <SkDarkCard key={i} />
                  ))}
                </div>
              ) : (
                <>
                  {/* ── PERFIL ── */}
                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "perfil"}
                    style={show("perfil")}
                  >
                    {(() => {
                      const userEmail = user?.email || "";
                      const userPhoto =
                        user?.photoURL ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=2563EB&color=fff&size=64&bold=true`;
                      return (
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 16,
                              marginBottom: 20,
                              padding: "20px",
                              background: "linear-gradient(135deg,#0E1835,#0A1228)",
                              borderRadius: 20,
                              border: "1px solid rgba(59,110,248,0.2)",
                              boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
                            }}
                          >
                            <img
                              src={userPhoto}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                border: "3px solid #3B82F6",
                              }}
                              alt="perfil"
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                                {userName}
                              </div>
                              {userEmail && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.35)",
                                    marginTop: 2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {userEmail}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            className="v360-btn-logout"
                            onClick={() => setConfirmLogout(true)}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={T.red}
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Cerrar sesión
                          </button>
                          {confirmLogout && (
                            <div className="v360-overlay">
                              <div className="v360-confirm-box">
                                <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
                                <div
                                  style={{
                                    fontSize: 17,
                                    fontWeight: 800,
                                    color: T.text,
                                    marginBottom: 8,
                                  }}
                                >
                                  ¿Cerrar sesión?
                                </div>
                                <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
                                  Tendrás que volver a iniciar sesión con Google.
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                  <button
                                    className="v360-confirm-cancel"
                                    onClick={() => setConfirmLogout(false)}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    className="v360-confirm-ok"
                                    onClick={async () => {
                                      await signOut(auth);
                                      setUser(null);
                                      setShowProfile(false);
                                      setConfirmLogout(false);
                                    }}
                                  >
                                    Salir
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          <FirebaseStatus
                            contratos={contratos}
                            paneles={paneles}
                            clientes={clientesActive}
                            gastos={gastos}
                            fbConnected={!error && !loading}
                            fbLoading={loading}
                            fbError={!!error}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── TABS CON PADDING ESTÁNDAR ── */}
                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "hoy"}
                    style={show("hoy")}
                  >
                    {error && (
                      <div className="v360-firebase-error">
                        <span style={{ fontSize: 22 }}>⚠️</span>
                        <div>
                          <div style={{ fontWeight: 700, color: T.amber, fontSize: 14 }}>
                            Sin conexión a Firebase
                          </div>
                          <div style={{ fontSize: 12, color: T.muted }}>
                            Despliega en Vercel para conectar.
                          </div>
                        </div>
                      </div>
                    )}
                    <ErrorBoundary label="Hoy">
                      <ResumenNuevo
                        clientes={clientesActive}
                        contratos={contratos}
                        paneles={paneles}
                        gastos={gastos}
                        setTab={setTab}
                        userName={userName}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "paneles"}
                    style={show("paneles")}
                  >
                    <ErrorBoundary label="Paneles">
                      <Paneles
                        paneles={paneles}
                        setPaneles={setPaneles}
                        contratos={contratos}
                        loading={loading}
                        setTab={setTab}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "historico"}
                    style={show("historico")}
                  >
                    <ErrorBoundary label="Histórico">
                      <Historico
                        contratos={contractsActive}
                        setContratos={setContratos}
                        paneles={paneles}
                        clientes={clientesActive}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "crm"}
                    style={show("crm")}
                  >
                    <ErrorBoundary label="CRM">
                      <CRM
                        clientes={clientesActive}
                        setClientes={setClientes}
                        contratos={contractsActive}
                        loading={loading}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "resultados"}
                    style={show("resultados")}
                  >
                    {/* lazyTab: solo se monta al visitar por primera vez */}
                    {lazyTab("resultados") && (
                      <ErrorBoundary label="Resultados">
                        <Reportes
                          contratos={contractsActive}
                          paneles={paneles}
                          clientes={clientesActive}
                          gastos={gastos}
                          initialSeccion="resultados"
                        />
                      </ErrorBoundary>
                    )}
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "reportes"}
                    style={show("reportes")}
                  >
                    {lazyTab("reportes") && (
                      <ErrorBoundary label="Reportes">
                        <Reportes
                          contratos={contractsActive}
                          paneles={paneles}
                          clientes={clientesActive}
                          gastos={gastos}
                        />
                      </ErrorBoundary>
                    )}
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "gastos"}
                    style={show("gastos")}
                  >
                    <ErrorBoundary label="Gastos">
                      <Gastos
                        gastos={gastos}
                        setGastos={setGastos}
                        autoScan={autoScan}
                        setAutoScan={setAutoScan}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "proveedores"}
                    style={show("proveedores")}
                  >
                    <ErrorBoundary label="Proveedores">
                      <Proveedores
                        proveedores={proveedoresActive}
                        setProveedores={setProveedores}
                        loading={loading}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-padded"
                    role="tabpanel"
                    aria-hidden={activeTab !== "facturacion"}
                    style={show("facturacion")}
                  >
                    {lazyTab("facturacion") && (
                      <ErrorBoundary label="Facturación">
                        <Facturacion
                          contratos={contractsActive}
                          paneles={paneles}
                          clientes={clientesActive}
                        />
                      </ErrorBoundary>
                    )}
                  </div>

                  {/* ── TABS SIN PADDING (tienen cabecera de ancho completo) ── */}
                  <div
                    className="v360-tab-panel v360-tab-flush"
                    role="tabpanel"
                    aria-hidden={activeTab !== "contratos"}
                    style={show("contratos")}
                  >
                    <ErrorBoundary label="Contratos">
                      <Contratos
                        contratos={contratos}
                        setContratos={setContratos}
                        paneles={paneles}
                        clientes={clientesActive}
                        loading={loading}
                        setTab={setTab}
                        onModalChange={setAnyModalOpen}
                      />
                    </ErrorBoundary>
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-flush"
                    role="tabpanel"
                    aria-hidden={activeTab !== "capital"}
                    style={show("capital")}
                  >
                    {lazyTab("capital") && (
                      <ErrorBoundary label="Capital">
                        <Capital
                          paneles={paneles}
                          contratos={contractsActive}
                          gastos={gastos}
                          proveedores={proveedoresActive}
                        />
                      </ErrorBoundary>
                    )}
                  </div>

                  <div
                    className="v360-tab-panel v360-tab-flush"
                    role="tabpanel"
                    aria-hidden={activeTab !== "mapa"}
                    style={show("mapa")}
                  >
                    {lazyTab("mapa") && (
                      <ErrorBoundary label="Mapa">
                        <Mapa
                          paneles={paneles}
                          clientes={clientesActive}
                          contratos={contractsActive}
                        />
                      </ErrorBoundary>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── BOTTOM TAB BAR (flotante) ── */}
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
                        <div
                          key="add"
                          style={{ flex: 1, display: "flex", justifyContent: "center" }}
                        >
                          <button
                            aria-label="Agregar gasto"
                            onClick={() => {
                              setAutoScan(true);
                              handleTabClick("gastos");
                            }}
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: "50%",
                              background: "linear-gradient(180deg, #0E1A3B 0%, #15265A 100%)",
                              border: "3px solid rgba(255,255,255,0.95)",
                              cursor: "pointer",
                              touchAction: "manipulation",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow:
                                "0 8px 24px rgba(37,99,235,0.42), 0 2px 8px rgba(37,99,235,0.2)",
                              marginTop: -28,
                              transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        aria-label={t.label}
                        tabIndex={active ? 0 : -1}
                        onClick={() => handleTabClick(t.id)}
                        onKeyDown={e => {
                          // Patrón ARIA tablist: flechas ← → navegan entre tabs
                          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                          e.preventDefault();
                          const idx = NAV_TAB_IDS.indexOf(t.id);
                          if (idx === -1) return;
                          const next =
                            e.key === "ArrowRight"
                              ? NAV_TAB_IDS[(idx + 1) % NAV_TAB_IDS.length]
                              : NAV_TAB_IDS[(idx - 1 + NAV_TAB_IDS.length) % NAV_TAB_IDS.length];
                          handleTabClick(next);
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
                          cursor: "pointer",
                          touchAction: "manipulation",
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

            {/* ── DRAWER ── */}
            {/* ── NOTIF PANEL — a nivel raíz para evitar z-index/stacking-context bugs ── */}
            <NotifPanel
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              contratos={contratos}
              clientes={clientesActive}
              paneles={paneles}
              gastos={gastos}
            />
            <BusquedaGlobal
              open={globalSearch}
              onClose={() => setGlobalSearch(false)}
              paneles={paneles}
              clientes={clientesActive}
              contratos={contratos}
              onNavigate={handleTabClick}
            />
            <DrawerMenu
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              activeTab={activeTab}
              onTabClick={handleTabClick}
              onTrashOpen={() => setTrashOpen(true)}
              trashCount={trashCount}
              userName={userName}
              userInitials={userInitials}
            />
            <TrashModal
              open={trashOpen}
              onClose={() => setTrashOpen(false)}
              contratos={contratos}
              clientes={clientes}
              paneles={paneles}
              proveedores={proveedores}
              setContratos={setContratos}
              setClientes={setClientes}
              setPaneles={setPaneles}
              setProveedores={setProveedores}
            />
          </div>
        )}
      </ToastProvider>
    </>
  );
}
