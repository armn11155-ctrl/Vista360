/**
 * AppContext — estado global de datos de la aplicación.
 *
 * Propósito: eliminar el prop-drilling de 5 colecciones Firestore hacia
 * los 12+ módulos de features. Cualquier componente descendiente puede
 * leer datos con `useAppData()` y mutarlos con `useAppSetters()`.
 *
 * Separamos datos y setters en dos contextos distintos para que los
 * componentes que solo escriben (formularios) no se re-rendericen al
 * cambiar los datos, y viceversa.
 *
 * Migración gradual: App.tsx sigue siendo el proveedor. Los features
 * pueden migrar de props a useAppData() de forma incremental sin
 * romper nada.
 */

import React, { createContext, useContext } from "react";
import type { Panel, Cliente, Contrato, Gasto, Proveedor, AppData, AppSetters } from "../types";

// ── Contextos ─────────────────────────────────────────────────────

const AppDataContext = createContext<AppData | null>(null);
const AppSettersContext = createContext<AppSetters | null>(null);

// ── Hook de datos (solo lectura) ──────────────────────────────────

/**
 * Accede a los datos de la app en tiempo real.
 * Lanza si se usa fuera de <AppProvider>.
 */
export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside <AppProvider>");
  return ctx;
}

/**
 * Accede a los setters de estado de la app.
 * Lanza si se usa fuera de <AppProvider>.
 */
export function useAppSetters(): AppSetters {
  const ctx = useContext(AppSettersContext);
  if (!ctx) throw new Error("useAppSetters must be used inside <AppProvider>");
  return ctx;
}

// ── Vistas derivadas (memoizadas en el proveedor) ─────────────────

export interface AppDerivedData {
  contractsActive:   Contrato[];
  clientesActive:    Cliente[];
  proveedoresActive: Proveedor[];
  trashCount:        number;
  notifCount:        number;
}

const AppDerivedContext = createContext<AppDerivedData | null>(null);

export function useAppDerived(): AppDerivedData {
  const ctx = useContext(AppDerivedContext);
  if (!ctx) throw new Error("useAppDerived must be used inside <AppProvider>");
  return ctx;
}

// ── Proveedor ─────────────────────────────────────────────────────

interface AppProviderProps {
  data:     AppData;
  setters:  AppSetters;
  derived:  AppDerivedData;
  children: React.ReactNode;
}

export function AppProvider({ data, setters, derived, children }: AppProviderProps) {
  return (
    <AppDataContext.Provider value={data}>
      <AppSettersContext.Provider value={setters}>
        <AppDerivedContext.Provider value={derived}>
          {children}
        </AppDerivedContext.Provider>
      </AppSettersContext.Provider>
    </AppDataContext.Provider>
  );
}

// ── Re-exports de tipos para conveniencia ─────────────────────────
export type { Panel, Cliente, Contrato, Gasto, Proveedor };
