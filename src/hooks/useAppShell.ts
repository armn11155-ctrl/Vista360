import type { Dispatch, SetStateAction, RefObject } from "react";
import type { User } from "firebase/auth";

import { useOnlineStatus } from "./useOnlineStatus";
import { useServiceWorker } from "./useServiceWorker";
import { useNotifications } from "./useNotifications";
import { useDataShell } from "./useDataShell";
import { useUIShell } from "./useUIShell";
import { useHeaderShell } from "./useHeaderShell";
import type { AppData, AppSetters } from "../types";
import type { AppDerivedData } from "../context/AppContext";

export interface AppShellState {
  // UI toggles
  showProfile: boolean;
  setShowProfile: Dispatch<SetStateAction<boolean>>;
  drawerOpen: boolean;
  setDrawerOpen: Dispatch<SetStateAction<boolean>>;
  trashOpen: boolean;
  setTrashOpen: Dispatch<SetStateAction<boolean>>;
  autoScan: boolean;
  setAutoScan: Dispatch<SetStateAction<boolean>>;
  globalSearch: boolean;
  setGlobalSearch: Dispatch<SetStateAction<boolean>>;
  notifOpen: boolean;
  setNotifOpen: Dispatch<SetStateAction<boolean>>;
  confirmLogout: boolean;
  setConfirmLogout: Dispatch<SetStateAction<boolean>>;
  anyModalOpen: boolean;
  setAnyModalOpen: Dispatch<SetStateAction<boolean>>;

  // Refs
  scrollRef: RefObject<HTMLDivElement>;

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
 * useAppShell — compone los tres sub-hooks especializados.
 *
 * - useDataShell   → colecciones Firestore + datos derivados
 * - useUIShell     → estado de UI (modales, overlays, navegación)
 * - useHeaderShell → color de header, título, datos del usuario
 *
 * Cada sub-hook re-renderiza solo cuando cambia su propia porción
 * de estado. Los cambios de datos no afectan la UI shell y viceversa.
 */
export function useAppShell(user: User, onLogout: () => void): AppShellState {
  const isOnline = useOnlineStatus();
  const swRef = useServiceWorker();

  const data = useDataShell();
  const ui = useUIShell(onLogout);
  const header = useHeaderShell(user, ui.showProfile);

  // ── Push notifications de vencimiento ─────────────────────────────
  useNotifications({
    contractsActive: data.appDerived.contractsActive,
    paneles: data.appData.paneles,
    clientesActive: data.appDerived.clientesActive,
    swRef,
  });

  return {
    // UI
    ...ui,
    scrollRef: ui.scrollRef,
    isOnline,
    // Header
    headerColor: header.headerColor,
    headerDark: header.headerDark,
    userName: header.userName,
    userInitials: header.userInitials,
    // Data
    notifCount: data.appDerived.notifCount,
    trashCount: data.appDerived.trashCount,
    appData: data.appData,
    appSetters: data.appSetters,
    appDerived: data.appDerived,
  };
}
