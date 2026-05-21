import React, { useState, useEffect, useCallback, useRef, Component } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "./config/firebase";
import { fb } from "./services/firestore";
import { ToastProvider } from "./context/UIContext";
import { useViewportSetup } from "./hooks/useViewportSetup";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { T } from "./config/theme";
import { ALLOWED_EMAILS } from "./config/constants";
import { OfflineBanner } from "./components/ui";

import type { Panel, Cliente, Contrato, Gasto, Proveedor } from "./types";

// ── Lazy imports ───────────────────────────────────────────────────
const Splash         = React.lazy(() => import("./pages/Splash"));
const LoginScreen    = React.lazy(() => import("./components/features/auth/LoginScreen"));
const ResumenNuevo   = React.lazy(() => import("./components/features/dashboard/ResumenNuevo"));
const Paneles        = React.lazy(() => import("./components/features/paneles/Paneles"));
const Contratos      = React.lazy(() => import("./components/features/contratos/Contratos"));
const Historico      = React.lazy(() => import("./components/features/historico/Historico"));
const CRM            = React.lazy(() => import("./components/features/crm/CRM"));
const Gastos         = React.lazy(() => import("./components/features/gastos/Gastos"));
const Proveedores    = React.lazy(() => import("./components/features/proveedores/Proveedores"));
const Facturacion    = React.lazy(() => import("./components/features/facturacion/Facturacion"));
const Reportes       = React.lazy(() => import("./components/features/reportes/Reportes"));
const Capital        = React.lazy(() => import("./components/features/capital/Capital"));
const Mapa           = React.lazy(() => import("./components/features/mapa/Mapa"));
const NotifPanel     = React.lazy(() => import("./components/shared/NotifPanel"));
const DrawerMenu     = React.lazy(() => import("./components/layout/DrawerMenu"));
const BusquedaGlobal = React.lazy(() => import("./components/shared/BusquedaGlobal"));
const TrashModal     = React.lazy(() => import("./components/shared/TrashModal"));
const BottomTabBar   = React.lazy(() => import("./components/layout/BottomTabBar"));

// ── CSS Global ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: ${T.bg}; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes skPulse { 0%,100% { background-position:200% 0; } 50% { background-position:-200% 0; } }
  @keyframes spin { to { transform:rotate(360deg); } }
`;

// ── Error Boundary ─────────────────────────────────────────────────
interface EBState { error: string | null; }
class ErrorBoundary extends Component<{ label: string; children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(e: Error): EBState { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 20, color: T.red }}>
        [{this.props.label}] Error: {this.state.error}
      </div>
    );
    return this.props.children;
  }
}

// ── App ────────────────────────────────────────────────────────────
export default function App() {
  useViewportSetup();
  const online = useOnlineStatus();

  const [user,      setUser     ] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splash,    setSplash   ] = useState(true);

  const [paneles,     setPaneles    ] = useState<Panel[]>([]);
  const [clientes,    setClientes   ] = useState<Cliente[]>([]);
  const [contratos,   setContratos  ] = useState<Contrato[]>([]);
  const [gastos,      setGastos     ] = useState<Gasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading,     setLoading    ] = useState(true);

  const [activeTab,     setActiveTab    ] = useState("hoy");
  const [drawerOpen,    setDrawerOpen   ] = useState(false);
  const [notifOpen,     setNotifOpen    ] = useState(false);
  const [globalSearch,  setGlobalSearch ] = useState(false);
  const [trashOpen,     setTrashOpen    ] = useState(false);
  const [anyModalOpen,  setAnyModalOpen ] = useState(false);
  const [autoScan,      setAutoScan     ] = useState(false);
  const visitedTabs = useRef<Set<string>>(new Set(["hoy"]));

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubs = [
      fb.subscribe<Panel>    ("paneles",     items => { setPaneles(items);     setLoading(false); }),
      fb.subscribe<Cliente>  ("clientes",    items => setClientes(items)),
      fb.subscribe<Contrato> ("contratos",   items => setContratos(items)),
      fb.subscribe<Gasto>    ("gastos",      items => setGastos(items)),
      fb.subscribe<Proveedor>("proveedores", items => setProveedores(items)),
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  const panelsActive    = paneles.filter(p => !p.deleted);
  const clientesActive  = clientes.filter(c => !c.deleted);
  const contractsActive = contratos.filter(c => !c.deleted);
  const provActive      = proveedores.filter(p => !p.deleted);
  const trashCount = [paneles, clientes, contratos, proveedores]
    .flatMap(arr => arr.filter((x: any) => x.deleted)).length;

  const userName     = user?.displayName || user?.email || "";
  const userInitials = userName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  const handleTabClick = useCallback((tab: string) => {
    setActiveTab(tab);
    visitedTabs.current.add(tab);
  }, []);

  const lazyTab = (tab: string) => visitedTabs.current.has(tab);
  const show    = (tab: string): React.CSSProperties => ({ display: activeTab === tab ? "block" : "none" });

  if (!authReady || splash) {
    return (
      <React.Suspense fallback={<div style={{ background: "#0A0F1E", minHeight: "100dvh" }}/>}>
        <Splash done={() => setSplash(false)}/>
      </React.Suspense>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <React.Suspense fallback={null}>
          <LoginScreen onLoginSuccess={(u: User) => setUser(u)}/>
        </React.Suspense>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <style>{GLOBAL_CSS}</style>
      {!online && <OfflineBanner/>}
      <div style={{ minHeight: "100dvh", background: T.bg, paddingTop: "env(safe-area-inset-top)" }}>
        <React.Suspense fallback={null}>

          <div style={show("hoy")}>
            <ErrorBoundary label="Hoy"><ResumenNuevo clientes={clientesActive} contratos={contractsActive} paneles={panelsActive} gastos={gastos} setTab={setActiveTab} userName={userName}/></ErrorBoundary>
          </div>
          <div style={show("paneles")}>
            <ErrorBoundary label="Paneles"><Paneles paneles={panelsActive} setPaneles={setPaneles} contratos={contractsActive} loading={loading} setTab={setActiveTab} onModalChange={setAnyModalOpen}/></ErrorBoundary>
          </div>
          <div style={show("contratos")}>
            <ErrorBoundary label="Contratos"><Contratos contratos={contratos} setContratos={setContratos} paneles={panelsActive} clientes={clientesActive} loading={loading} setTab={setActiveTab} onModalChange={setAnyModalOpen}/></ErrorBoundary>
          </div>
          <div style={show("historico")}>
            {lazyTab("historico") && <ErrorBoundary label="Histórico"><Historico contratos={contractsActive} setContratos={setContratos} paneles={panelsActive} clientes={clientesActive} onModalChange={setAnyModalOpen}/></ErrorBoundary>}
          </div>
          <div style={show("crm")}>
            <ErrorBoundary label="CRM"><CRM clientes={clientesActive} setClientes={setClientes} contratos={contractsActive} loading={loading} onModalChange={setAnyModalOpen}/></ErrorBoundary>
          </div>
          <div style={show("gastos")}>
            <ErrorBoundary label="Gastos"><Gastos gastos={gastos} setGastos={setGastos} autoScan={autoScan} setAutoScan={setAutoScan} onModalChange={setAnyModalOpen}/></ErrorBoundary>
          </div>
          <div style={show("proveedores")}>
            <ErrorBoundary label="Proveedores"><Proveedores proveedores={provActive} setProveedores={setProveedores} loading={loading} onModalChange={setAnyModalOpen}/></ErrorBoundary>
          </div>
          {lazyTab("facturacion") && <div style={show("facturacion")}>
            <ErrorBoundary label="Facturación"><Facturacion contratos={contractsActive} paneles={panelsActive} clientes={clientesActive}/></ErrorBoundary>
          </div>}
          {lazyTab("reportes") && <div style={show("reportes")}>
            <ErrorBoundary label="Reportes"><Reportes contratos={contractsActive} paneles={panelsActive} clientes={clientesActive} gastos={gastos}/></ErrorBoundary>
          </div>}
          {lazyTab("resultados") && <div style={show("resultados")}>
            <ErrorBoundary label="Resultados"><Reportes contratos={contractsActive} paneles={panelsActive} clientes={clientesActive} gastos={gastos} initialSeccion="resultados"/></ErrorBoundary>
          </div>}
          {lazyTab("capital") && <div style={show("capital")}>
            <ErrorBoundary label="Capital"><Capital paneles={panelsActive} contratos={contractsActive} gastos={gastos} proveedores={provActive}/></ErrorBoundary>
          </div>}
          {lazyTab("mapa") && <div style={show("mapa")}>
            <ErrorBoundary label="Mapa"><Mapa paneles={panelsActive} clientes={clientesActive} contratos={contractsActive}/></ErrorBoundary>
          </div>}

          {!anyModalOpen && (
            <BottomTabBar activeTab={activeTab} onTabClick={handleTabClick}
              onScanPress={() => { setAutoScan(true); handleTabClick("gastos"); }}/>
          )}

          <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} contratos={contratos} clientes={clientesActive} paneles={panelsActive} gastos={gastos}/>
          <BusquedaGlobal open={globalSearch} onClose={() => setGlobalSearch(false)} paneles={panelsActive} clientes={clientesActive} contratos={contratos} onNavigate={handleTabClick}/>
          <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} activeTab={activeTab} onTabClick={handleTabClick} onTrashOpen={() => setTrashOpen(true)} trashCount={trashCount} userName={userName} userInitials={userInitials}/>
          <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} contratos={contratos} clientes={clientes} paneles={paneles} proveedores={proveedores} setContratos={setContratos} setClientes={setClientes} setPaneles={setPaneles} setProveedores={setProveedores}/>

        </React.Suspense>
      </div>
    </ToastProvider>
  );
}
