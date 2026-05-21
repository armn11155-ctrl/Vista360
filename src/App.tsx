import React, { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "./config/firebase";
import { fb } from "./services/firestore";
import { ToastProvider } from "./context/UIContext";
import { useViewportSetup } from "./hooks/useViewportSetup";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { T } from "./config/theme";
import { BOTTOM_TABS_LIST, NAV_TAB_IDS, ALLOWED_EMAILS } from "./config/constants";

import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "./types";

// ── Lazy imports para tabs menos frecuentes ───────────────────────
// Los componentes pesados se importan dinámicamente para mejorar
// el tiempo de carga inicial (code splitting).
const Splash        = React.lazy(() => import("./pages/Splash"));
const LoginScreen   = React.lazy(() => import("./components/features/auth/LoginScreen"));
const ResumenNuevo  = React.lazy(() => import("./components/features/dashboard/ResumenNuevo"));
const Paneles       = React.lazy(() => import("./components/features/paneles/Paneles"));
const Contratos     = React.lazy(() => import("./components/features/contratos/Contratos"));
const Historico     = React.lazy(() => import("./components/features/historico/Historico"));
const CRM           = React.lazy(() => import("./components/features/crm/CRM"));
const Gastos        = React.lazy(() => import("./components/features/gastos/Gastos"));
const Proveedores   = React.lazy(() => import("./components/features/proveedores/Proveedores"));
const Facturacion   = React.lazy(() => import("./components/features/facturacion/Facturacion"));
const Reportes      = React.lazy(() => import("./components/features/reportes/Reportes"));
const Capital       = React.lazy(() => import("./components/features/capital/Capital"));
const Mapa          = React.lazy(() => import("./components/features/mapa/Mapa"));
const NotifPanel    = React.lazy(() => import("./components/shared/NotifPanel"));
const DrawerMenu    = React.lazy(() => import("./components/layout/DrawerMenu"));
const BusquedaGlobal= React.lazy(() => import("./components/shared/BusquedaGlobal"));
const TrashModal    = React.lazy(() => import("./components/shared/TrashModal"));
const BottomTabBar  = React.lazy(() => import("./components/layout/BottomTabBar"));
const { OfflineBanner } = require("./components/ui");

// ── CSS Global ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: ${T.bg}; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes skPulse { 0%,100% { background-position:200% 0; } 50% { background-position:-200% 0; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  .v360-tab-panel { display:none; }
  .v360-tab-panel[aria-hidden="false"] { display:block; }
  .v360-tab-padded { padding:0 16px 120px; }
  .v360-tab-flush  { padding:0 0 120px; }
`;

function ErrorBoundary({ label, children }: { label: string; children: React.ReactNode }) {
  const [err, setErr] = React.useState<string | null>(null);
  if (err) return <div style={{ padding:20, color:T.red }}>[{label}] Error: {err}</div>;
  return (
    <React.Component onCatch={(e: Error) => setErr(e.message)}>
      {children}
    </React.Component>
  );
}

export default function App() {
  useViewportSetup();
  const online = useOnlineStatus();

  // ── Auth state ────────────────────────────────────────────────
  const [user,    setUser   ] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splash,  setSplash ] = useState(true);

  // ── Data state ────────────────────────────────────────────────
  const [paneles,    setPaneles   ] = useState<Panel[]>([]);
  const [clientes,   setClientes  ] = useState<Cliente[]>([]);
  const [contratos,  setContratos ] = useState<Contrato[]>([]);
  const [gastos,     setGastos    ] = useState<Gasto[]>([]);
  const [proveedores,setProveedores] = useState<Proveedor[]>([]);
  const [loading,    setLoading   ] = useState(true);

  // ── UI state ──────────────────────────────────────────────────
  const [activeTab,    setActiveTab   ] = useState("hoy");
  const [drawerOpen,   setDrawerOpen  ] = useState(false);
  const [notifOpen,    setNotifOpen   ] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [trashOpen,    setTrashOpen   ] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);
  const [autoScan,     setAutoScan    ] = useState(false);
  const visitedTabs = useRef<Set<string>>(new Set(["hoy"]));

  // ── Auth listener ─────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u); setAuthReady(true);
    });
  }, []);

  // ── Data subscriptions (solo si autenticado) ──────────────────
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubs = [
      fb.subscribe<Panel>    ("paneles",    setPaneles),
      fb.subscribe<Cliente>  ("clientes",   setClientes),
      fb.subscribe<Contrato> ("contratos",  setContratos),
      fb.subscribe<Gasto>    ("gastos",     setGastos),
      fb.subscribe<Proveedor>("proveedores",setProveedores),
    ];
    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, [user]);

  // ── Derived data ──────────────────────────────────────────────
  const panelsActive    = paneles.filter(p => !p.deleted);
  const clientesActive  = clientes.filter(c => !c.deleted);
  const contractsActive = contratos.filter(c => !c.deleted);
  const provActive      = proveedores.filter(p => !p.deleted);
  const trashCount = [
    paneles.filter(p => p.deleted).length,
    clientes.filter(c => c.deleted).length,
    contratos.filter(c => c.deleted).length,
    proveedores.filter(p => p.deleted).length,
  ].reduce((a, b) => a + b, 0);

  const userName     = user?.displayName || user?.email || "";
  const userInitials = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) || "?";

  const handleTabClick = useCallback((tab: string) => {
    setActiveTab(tab);
    visitedTabs.current.add(tab);
  }, []);

  const lazyTab  = (tab: string) => visitedTabs.current.has(tab);
  const show     = (tab: string): React.CSSProperties =>
    ({ display: activeTab === tab ? "block" : "none" });

  // ── Render ────────────────────────────────────────────────────
  if (!authReady || splash) {
    return (
      <React.Suspense fallback={null}>
        <Splash done={() => setSplash(false)}/>
      </React.Suspense>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <React.Suspense fallback={null}>
          <LoginScreen onLoginSuccess={u => setUser(u)}/>
        </React.Suspense>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <style>{GLOBAL_CSS}</style>
      {!online && <OfflineBanner/>}

      <div style={{ minHeight:"100dvh", background:T.bg,
        paddingTop:`env(safe-area-inset-top)`, position:"relative" }}>

        {/* ── TABS ── */}
        <React.Suspense fallback={null}>
          <div style={show("hoy")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="hoy"}>
            <ResumenNuevo clientes={clientesActive} contratos={contractsActive} paneles={panelsActive} gastos={gastos} setTab={setActiveTab} userName={userName}/>
          </div>
          <div style={show("paneles")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="paneles"}>
            <Paneles paneles={panelsActive} setPaneles={setPaneles} contratos={contractsActive} loading={loading} setTab={setActiveTab} onModalChange={setAnyModalOpen}/>
          </div>
          <div style={show("contratos")} className="v360-tab-panel v360-tab-flush" role="tabpanel" aria-hidden={activeTab!=="contratos"}>
            <Contratos contratos={contratos} setContratos={setContratos} paneles={panelsActive} clientes={clientesActive} loading={loading} setTab={setActiveTab} onModalChange={setAnyModalOpen}/>
          </div>
          <div style={show("historico")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="historico"}>
            {lazyTab("historico") && <Historico contratos={contractsActive} setContratos={setContratos} paneles={panelsActive} clientes={clientesActive} onModalChange={setAnyModalOpen}/>}
          </div>
          <div style={show("crm")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="crm"}>
            <CRM clientes={clientesActive} setClientes={setClientes} contratos={contractsActive} loading={loading} onModalChange={setAnyModalOpen}/>
          </div>
          <div style={show("gastos")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="gastos"}>
            <Gastos gastos={gastos} setGastos={setGastos} autoScan={autoScan} setAutoScan={setAutoScan} onModalChange={setAnyModalOpen}/>
          </div>
          <div style={show("proveedores")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="proveedores"}>
            <Proveedores proveedores={provActive} setProveedores={setProveedores} loading={loading} onModalChange={setAnyModalOpen}/>
          </div>
          {lazyTab("facturacion") && <div style={show("facturacion")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="facturacion"}>
            <Facturacion contratos={contractsActive} paneles={panelsActive} clientes={clientesActive}/>
          </div>}
          {lazyTab("reportes") && <div style={show("reportes")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="reportes"}>
            <Reportes contratos={contractsActive} paneles={panelsActive} clientes={clientesActive} gastos={gastos}/>
          </div>}
          {lazyTab("resultados") && <div style={show("resultados")} className="v360-tab-panel v360-tab-padded" role="tabpanel" aria-hidden={activeTab!=="resultados"}>
            <Reportes contratos={contractsActive} paneles={panelsActive} clientes={clientesActive} gastos={gastos} initialSeccion="resultados"/>
          </div>}
          {lazyTab("capital") && <div style={show("capital")} className="v360-tab-panel v360-tab-flush" role="tabpanel" aria-hidden={activeTab!=="capital"}>
            <Capital paneles={panelsActive} contratos={contractsActive} gastos={gastos} proveedores={provActive}/>
          </div>}
          {lazyTab("mapa") && <div style={show("mapa")} className="v360-tab-panel v360-tab-flush" role="tabpanel" aria-hidden={activeTab!=="mapa"}>
            <Mapa paneles={panelsActive} clientes={clientesActive} contratos={contractsActive}/>
          </div>}
        </React.Suspense>

        {/* ── BOTTOM TAB BAR ── */}
        {!anyModalOpen && (
          <React.Suspense fallback={null}>
            <BottomTabBar activeTab={activeTab} onTabClick={handleTabClick} onScanPress={() => { setAutoScan(true); handleTabClick("gastos"); }}/>
          </React.Suspense>
        )}

        {/* ── OVERLAYS ── */}
        <React.Suspense fallback={null}>
          <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} contratos={contratos} clientes={clientesActive} paneles={panelsActive} gastos={gastos}/>
          <BusquedaGlobal open={globalSearch} onClose={() => setGlobalSearch(false)} paneles={panelsActive} clientes={clientesActive} contratos={contratos} onNavigate={handleTabClick}/>
          <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} onTabClick={handleTabClick} onTrashOpen={() => setTrashOpen(true)} trashCount={trashCount} userName={userName} userInitials={userInitials}/>
          <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} contratos={contratos} clientes={clientes} paneles={paneles} proveedores={proveedores} setContratos={setContratos} setClientes={setClientes} setPaneles={setPaneles} setProveedores={setProveedores}/>
        </React.Suspense>
      </div>
    </ToastProvider>
  );
}
