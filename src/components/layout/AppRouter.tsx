import { lazy, Suspense } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

import { ErrorBoundary } from "../shared/ErrorBoundary";
import { TabSuspense, SkDarkCard } from "../shared/AppSkeletons";
import { useAppData, useAppSetters, useAppDerived } from "../../context/AppContext";

// ── Carga lazy por ruta (code-splitting) ────────────────────────
const ResumenNuevo = lazy(() => import("../features/dashboard/ResumenNuevo"));
const Paneles = lazy(() => import("../features/paneles/Paneles"));
const Contratos = lazy(() => import("../features/contratos/Contratos"));
const Historico = lazy(() => import("../features/historico/Historico"));
const CRM = lazy(() => import("../features/crm/CRM"));
const Gastos = lazy(() => import("../features/gastos/Gastos"));
const Proveedores = lazy(() => import("../features/proveedores/Proveedores"));
const Facturacion = lazy(() => import("../features/facturacion/Facturacion"));
const Reportes = lazy(() => import("../features/reportes/Reportes"));
const Capital = lazy(() => import("../features/capital/Capital"));
const Mapa = lazy(() => import("../features/mapa/Mapa"));
const BuscarComprobante = lazy(() => import("../features/facturacion/BuscarComprobante"));

/**
 * Prefetch de todos los chunks en segundo plano una vez que el usuario está
 * autenticado. El browser descarga y cachea cada módulo mientras el usuario
 * ve la primera pestaña — al cambiar ya está en memoria.
 */
export function prefetchAllTabs() {
  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 200);

  schedule(() => {
    import("../features/contratos/Contratos");
    import("../features/paneles/Paneles");
    import("../features/crm/CRM");
    import("../features/gastos/Gastos");
  });

  schedule(() => {
    import("../features/proveedores/Proveedores");
    import("../features/facturacion/Facturacion");
    import("../features/reportes/Reportes");
    import("../features/historico/Historico");
    import("../features/capital/Capital");
    import("../features/mapa/Mapa");
    import("../features/facturacion/BuscarComprobante");
  });
}

// Props mínimas: solo estado de UI que no vive en AppContext
export interface AppRouterProps {
  userName: string;
  autoScan: boolean;
  setAutoScan: Dispatch<SetStateAction<boolean>>;
  onModalChange: Dispatch<SetStateAction<boolean>>;
}

/**
 * AppRouter — árbol de rutas de la aplicación autenticada.
 *
 * Lee datos directamente de AppContext (useAppData, useAppDerived, useAppSetters)
 * eliminando el prop drilling de colecciones desde App → AppRouter → features.
 */
export function AppRouter({ userName, autoScan, setAutoScan, onModalChange }: AppRouterProps) {
  const navigate = useNavigate();

  // ── Datos desde contexto (sin prop drilling) ──────────────────────
  const { paneles, contratos, gastos, loading, error, refetch } = useAppData();
  const { contractsActive, clientesActive, proveedoresActive } = useAppDerived();
  const { setPaneles, setContratos, setClientes, setGastos, setProveedores } = useAppSetters();

  // ── Banner de error con retry ─────────────────────────────────────
  const ErrorBanner = error ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: "rgba(255,107,107,.1)",
        borderRadius: 8,
        margin: "8px 0",
      }}
    >
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div style={{ fontSize: 13, flex: 1 }}>Sin conexión a Firebase</div>
      <button
        onClick={refetch}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,107,107,.4)",
          background: "transparent",
          color: "inherit",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Reintentar
      </button>
    </div>
  ) : null;

  return (
    <Suspense fallback={<TabSuspense />}>
      <Routes>
        <Route
          path="/"
          element={
            <div className="tabPanel tabPadded">
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[1, 2, 3, 4].map(i => (
                    <SkDarkCard key={i} />
                  ))}
                </div>
              ) : (
                <>
                  {ErrorBanner}
                  <ErrorBoundary label="Inicio">
                    <ResumenNuevo
                      clientes={clientesActive}
                      contratos={contratos}
                      paneles={paneles}
                      gastos={gastos}
                      setTab={(id: string) => navigate(`/${id === "hoy" ? "" : id}`)}
                      userName={userName}
                    />
                  </ErrorBoundary>
                </>
              )}
            </div>
          }
        />
        <Route
          path="/paneles"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Paneles">
                <Paneles
                  paneles={paneles}
                  setPaneles={setPaneles}
                  contratos={contratos}
                  loading={loading}
                  setTab={(id: string) => navigate(`/${id}`)}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/contratos"
          element={
            <div className="tabPanel tabFlush">
              <ErrorBoundary label="Contratos">
                <Contratos
                  contratos={contratos}
                  setContratos={setContratos}
                  paneles={paneles}
                  clientes={clientesActive}
                  loading={loading}
                  setTab={(id: string) => navigate(`/${id}`)}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/historico"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Histórico">
                <Historico
                  contratos={contractsActive}
                  setContratos={setContratos}
                  paneles={paneles}
                  clientes={clientesActive}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/crm"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="CRM">
                <CRM
                  clientes={clientesActive}
                  setClientes={setClientes}
                  contratos={contractsActive}
                  loading={loading}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/gastos"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Gastos">
                <Gastos
                  gastos={gastos}
                  setGastos={setGastos}
                  autoScan={autoScan}
                  setAutoScan={setAutoScan}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/proveedores"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Proveedores">
                <Proveedores
                  proveedores={proveedoresActive}
                  setProveedores={setProveedores}
                  loading={loading}
                  onModalChange={onModalChange}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/facturacion"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Facturación">
                <Facturacion
                  contratos={contractsActive}
                  paneles={paneles}
                  clientes={clientesActive}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/resultados"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Resultados">
                <Reportes
                  contratos={contractsActive}
                  paneles={paneles}
                  clientes={clientesActive}
                  gastos={gastos}
                  initialSeccion="resultados"
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/reportes"
          element={
            <div className="tabPanel tabPadded">
              <ErrorBoundary label="Reportes">
                <Reportes
                  contratos={contractsActive}
                  paneles={paneles}
                  clientes={clientesActive}
                  gastos={gastos}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/capital"
          element={
            <div className="tabPanel tabFlush">
              <ErrorBoundary label="Capital">
                <Capital
                  paneles={paneles}
                  contratos={contractsActive}
                  gastos={gastos}
                  proveedores={proveedoresActive}
                />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/mapa"
          element={
            <div className="tabPanel tabFlush">
              <ErrorBoundary label="Mapa">
                <Mapa paneles={paneles} clientes={clientesActive} contratos={contractsActive} />
              </ErrorBoundary>
            </div>
          }
        />
        <Route
          path="/buscar"
          element={
            <ErrorBoundary label="Buscar Comprobante">
              <BuscarComprobante />
            </ErrorBoundary>
          }
        />
      </Routes>
    </Suspense>
  );
}

