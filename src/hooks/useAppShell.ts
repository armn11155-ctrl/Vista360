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
