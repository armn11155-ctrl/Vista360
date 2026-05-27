import { useState, useEffect } from "react";
import { HashRouter } from "react-router-dom";
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
import { Logo360 } from "./components/layout/Logo360";
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
          title={
            shell.showProfile
              ? "Perfil"
              : ((shell.appDerived as unknown as Record<string, string>)["tabTitle"] ?? "Vista360")
          }
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

        <main
          ref={shell.scrollRef}
          data-scroll
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            overscrollBehavior: "none",
            touchAction: "pan-y",
            position: "relative",
          }}
        >
          {shell.showProfile ? (
            <ProfileView
              user={user}
              userName={shell.userName}
              gastos={shell.appData.gastos}
              confirmLogout={shell.confirmLogout}
              setConfirmLogout={shell.setConfirmLogout}
              onLogout={shell.handleLogout}
            />
          ) : (
            <AppRouter
              loading={shell.appData.loading}
              error={shell.appData.error}
              userName={shell.userName}
              autoScan={shell.autoScan}
              setAutoScan={shell.setAutoScan}
              onModalChange={shell.setAnyModalOpen}
              paneles={shell.appData.paneles}
              clientes={shell.appData.clientes}
              contratos={shell.appData.contratos}
              gastos={shell.appData.gastos}
              proveedores={shell.appData.proveedores}
              contractsActive={shell.appDerived.contractsActive}
              clientesActive={shell.appDerived.clientesActive}
              proveedoresActive={shell.appDerived.proveedoresActive}
            />
          )}
        </main>

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
    }, 5000);
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        u => {
          clearTimeout(fallback);
          setFbDown(false);
          if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email ?? "")) {
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
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#F2F4F8;-webkit-text-size-adjust:100%}
        body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;background:transparent}
        button,a,select,[role='button'],[role='tab'],[role='menuitem'],[role='option']{touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent;font-family:inherit}
        button:active{opacity:0.78;transform:scale(0.96)}
        input,select,textarea{-webkit-appearance:none;appearance:none;font-size:16px!important;scroll-margin-bottom:180px;touch-action:manipulation}
        input,textarea{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
        ::-webkit-scrollbar{display:none}
        [data-scroll]{overscroll-behavior:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes skPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{from{opacity:.2}to{opacity:.6}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
        .tabPanel{display:flex;flex-direction:column;min-height:100%}
        .tabPadded{padding:0 16px 80px}
        .tabFlush{padding-bottom:80px}
      `}</style>

      {splash && <Splash done={() => setSplash(false)} />}

      {!splash && !authReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.dark,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 998,
          }}
        >
          <Logo360 width={120} />
        </div>
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
export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
