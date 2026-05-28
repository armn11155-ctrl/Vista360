import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

/**
 * useUIShell — estado de UI de la shell autenticada.
 *
 * Gestiona modales, overlays y navegación.
 * Completamente independiente de los datos de Firestore para
 * evitar re-renders cruzados.
 */
export function useUIShell(onLogout: () => void) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── UI toggles ─────────────────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [anyModalOpen, setAnyModalOpen] = useState(false);

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

  return {
    // refs
    scrollRef,
    // state + setters
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
    // actions
    handleTabClick,
    handleLogout,
  };
}
