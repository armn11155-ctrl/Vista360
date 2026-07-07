import { useMemo, useCallback } from "react";
import { useCollection } from "./useCollection";
import type { Panel, Cliente, Contrato, Gasto, Proveedor, AppData, AppSetters } from "../types";
import type { AppDerivedData } from "../context/AppContext";

/**
 * useDataShell — gestiona las 5 colecciones Firestore y sus datos derivados.
 *
 * Separado de useUIShell para que los cambios de datos no provoquen
 * re-renders en los componentes puramente de UI y viceversa.
 */
export function useDataShell() {
  // ── Colecciones Firestore ──────────────────────────────────────────
  const paneles = useCollection<Panel>("paneles");
  const clientes = useCollection<Cliente>("clientes");
  const contratos = useCollection<Contrato>("contratos");
  const gastos = useCollection<Gasto>("gastos");
  const proveedores = useCollection<Proveedor>("proveedores");

  const loading = paneles.loading || contratos.loading;
  const error =
    paneles.error ?? clientes.error ?? contratos.error ?? gastos.error ?? proveedores.error;

  // ── Refetch manual de todas las colecciones ───────────────────────
  const refetch = useCallback(() => {
    void paneles.refetch();
    void clientes.refetch();
    void contratos.refetch();
    void gastos.refetch();
    void proveedores.refetch();
  }, [paneles, clientes, contratos, gastos, proveedores]);

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

  // ── AppContext values (memoizados para evitar re-renders) ──────────
  const appData: AppData = useMemo(
    () => ({
      paneles: paneles.data,
      clientes: clientes.data,
      contratos: contratos.data,
      gastos: gastos.data,
      proveedores: proveedores.data,
      loading,
      error,
      refetch,
    }),
    [
      paneles.data,
      clientes.data,
      contratos.data,
      gastos.data,
      proveedores.data,
      loading,
      error,
      refetch,
    ],
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

  return { appData, appSetters, appDerived };
}
