import { useState, useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth } from "./config/firebase";
import { T } from "./config/theme";
import { ALLOWED_EMAILS } from "./config/constants";
import { ToastProvider } from "./context/UIContext";
import { AppProvider } from "./context/AppContext";
import { useAppShell } from "./hooks/useAppShell";
import { useViewportSetup } from "./hooks/useViewportSetup";
import { prefetchAllTabs, AppRouter } from "./components/layout/AppRouter";
import { ShellErrorBoundary } from "./components/shared/ShellErrorBoundary";
import { AppHeader } from "./components/layout/AppHeader";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { OfflineBanner } from "./components/ui";
import { BTM_ICONS } from "./components/layout/BottomTabIcons";
import { BOTTOM_TABS_LIST } from "./config/constants";
import { ProfileView } from "./components/features/profile/ProfileView";
import DrawerMenu from "./components/layout/DrawerMenu";
import NotifPanel from "./components/shared/NotifPanel";
import BusquedaGlobal from "./components/shared/BusquedaGlobal";
import TrashModal from "./components/shared/TrashModal";
import Splash from "./pages/Splash";
import LoginScreen from "./components/features/auth/LoginScreen";

import styles from "./App.module.css";

// ══════════════════════════════════════════════════════════════════
// AuthenticatedShell — renderizador puro; toda la lógica en useAppShell
// ══════════════════════════════════════════════════════════════════
interface AuthenticatedShellProps {
  user: User;
  onLogout: () => void;
}

function AuthenticatedShell({ user, onLogout }: AuthenticatedShellProps) {
  const shell = useAppShell(user, onLogout);

  return (
    <AppProvider data={shell.appData} setters={shell.appSetters} derived={shell.appDerived}>
      {!shell.isOnline && <OfflineBanner />}
      <div className={styles.appRoot} style={{ background: T.bg, color: T.text }}>
        <AppHeader
          title={shell.showProfile ? "Perfil" : (shell.pageTitle ?? "Inicio")}
          user={user}
          userName={shell.userName}
          onProfileClick={() => shell.handleTabClick("/perfil")}
          onSearchClick={() => shell.setGlobalSearch(true)}
          onNotifClick={() => shell.setNotifOpen(v => !v)}
          notifCount={shell.notifCount}
          headerColor={shell.headerColor}
          headerDark={shell.headerDark}
          onDrawerClick={() => shell.setDrawerOpen(true)}
          showProfile={shell.showProfile}
        />

        {/* ── Perfil ── */}
        {shell.showProfile && (
          <main
            ref={shell.scrollRef}
            data-scroll
            style={{
              flex: 1, minHeight: 0,
              overflowY: "scroll", overflowX: "hidden",
              overscrollBehavior: "none",
            }}
          >
            <ProfileView
              user={user}
              userName={shell.userName}
              gastos={shell.appData.gastos}
              confirmLogout={shell.confirmLogout}
              setConfirmLogout={shell.setConfirmLogout}
              onLogout={shell.handleLogout}
            />
          </main>
        )}

        {/* ── Tabs ── */}
        {!shell.showProfile && (
          <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
            <div
              ref={shell.scrollRef}
              data-scroll
              style={{
                position: "absolute",
                inset: 0,
                overflowY: "scroll",
                overflowX: "hidden",
                overscrollBehavior: "none",
                touchAction: "pan-y",
              }}
            >
              <AppRouter
                userName={shell.userName}
                autoScan={shell.autoScan}
                setAutoScan={shell.setAutoScan}
                onModalChange={shell.setAnyModalOpen}
              />
            </div>
          </div>
        )}

        {!shell.anyModalOpen && (
          <BottomTabBar
            tabs={BOTTOM_TABS_LIST}
            icons={BTM_ICONS}
            showProfile={shell.showProfile}
            onTabClick={path => shell.handleTabClick(path)}
            onAddClick={() => {
              shell.setAutoScan(true);
              shell.handleTabClick("/gastos");
            }}
          />
        )}

        <NotifPanel
          open={shell.notifOpen}
          onClose={() => shell.setNotifOpen(false)}
          contratos={shell.appData.contratos}
          clientes={shell.appDerived.clientesActive}
          paneles={shell.appData.paneles}
          gastos={shell.appData.gastos}
        />
        <BusquedaGlobal
          open={shell.globalSearch}
          onClose={() => shell.setGlobalSearch(false)}
          paneles={shell.appData.paneles}
          clientes={shell.appDerived.clientesActive}
          contratos={shell.appData.contratos}
          onNavigate={(id: string) => shell.handleTabClick(id === "hoy" ? "/" : `/${id}`)}
        />
        <DrawerMenu
          open={shell.drawerOpen}
          onClose={() => shell.setDrawerOpen(false)}
          activeTab={shell.showProfile ? "perfil" : ""}
          onTabClick={shell.handleTabClick}
          onTrashOpen={() => shell.setTrashOpen(true)}
          trashCount={shell.trashCount}
          userName={shell.userName}
          userInitials={shell.userInitials}
        />
        <TrashModal
          open={shell.trashOpen}
          onClose={() => shell.setTrashOpen(false)}
          contratos={shell.appData.contratos}
          clientes={shell.appData.clientes}
          paneles={shell.appData.paneles}
          proveedores={shell.appData.proveedores}
          setContratos={shell.appSetters.setContratos}
          setClientes={shell.appSetters.setClientes}
          setPaneles={shell.appSetters.setPaneles}
          setProveedores={shell.appSetters.setProveedores}
        />
      </div>
    </AppProvider>
  );
}

// ══════════════════════════════════════════════════════════════════
// AppShell — gestiona splash y ciclo de auth de Firebase
// ══════════════════════════════════════════════════════════════════
function AppShell() {
  useViewportSetup();

  const [splash, setSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseDown, setFbDown] = useState(false);

  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    lockScroll();
    window.addEventListener("scroll", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", lockScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", lockScroll, { passive: true });
    return () => {
      document.removeEventListener("touchstart", noop);
      window.removeEventListener("scroll", lockScroll);
      window.visualViewport?.removeEventListener("resize", lockScroll);
      window.visualViewport?.removeEventListener("scroll", lockScroll);
    };
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => {
      setAuthReady(true);
      setFbDown(true);
    }, 3000);
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        u => {
          clearTimeout(fallback);
          setFbDown(false);
          if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email ?? "")) {
            // La whitelist del cliente es solo UX — las Firestore Rules son la barrera real
            signOut(auth);
            setUser(null);
          } else {
            setUser(u);
            if (u) {
              prefetchAllTabs();
              if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
              }
            }
          }
          setAuthReady(true);
        },
        err => {
          console.error("[Auth] error:", err);
          clearTimeout(fallback);
          setFbDown(true);
          setAuthReady(true);
        },
      );
    } catch (err) {
      console.error("[Auth] Firebase init error:", err);
      clearTimeout(fallback);
      setFbDown(true);
      setAuthReady(true);
    }
    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, []);

  return (
    <ToastProvider>
      {/* CSS global movido a src/index.css — ver refactor(styles) */}

      {splash && <Splash done={() => setSplash(false)} />}

      {!splash && !authReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.dark,
            zIndex: 998,
          }}
        />
      )}

      {!splash && authReady && !user && (
        <>
          {firebaseDown && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: "#7f1d1d",
                color: "#fecaca",
                padding: "10px 20px",
                fontSize: 13,
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              ⚠️ Sin conexión a Firebase — verifica tu red o intenta más tarde
            </div>
          )}
          <LoginScreen onLoginSuccess={(u: User) => setUser(u)} />
        </>
      )}

      {!splash && !!user && (
        <ShellErrorBoundary>
          <AuthenticatedShell user={user} onLogout={() => setUser(null)} />
        </ShellErrorBoundary>
      )}
    </ToastProvider>
  );
}

// ── Root ─────────────────────────────────────────────────────────
// BrowserRouter (fix: reemplaza HashRouter)
// Requiere public/_redirects con "/* /index.html 200" para Cloudflare Pages SPA.
// Las URLs pasan de /#/gastos → /gastos — más limpias y compatibles con PWA.
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
