import { useState, useEffect, useLayoutEffect, useRef } from "react";
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
import { useIsDesktop } from "./hooks/useIsDesktop";
import { prefetchAllTabs, AppRouter } from "./components/layout/AppRouter";
import { preloadData } from "./services/firestore";
import { ShellErrorBoundary } from "./components/shared/ShellErrorBoundary";
import { AppHeader } from "./components/layout/AppHeader";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { DesktopSidebar } from "./components/layout/DesktopSidebar";
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
// AuthenticatedShell
// ══════════════════════════════════════════════════════════════════
interface AuthenticatedShellProps {
  user: User;
  onLogout: () => void;
}

function AuthenticatedShell({ user, onLogout }: AuthenticatedShellProps) {
  const shell = useAppShell(user, onLogout);
  const isDesktop = useIsDesktop();

  // ── CLAVE: cuando es desktop, liberamos #root del position:fixed móvil ──
  // useLayoutEffect corre ANTES del primer paint → sin parpadeo.
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (isDesktop) {
      document.documentElement.style.overflow = "auto";
      document.documentElement.style.height = "auto";
      document.body.style.overflow = "auto";
      document.body.style.height = "auto";
      if (root) {
        root.style.position = "relative";
        root.style.top = "auto";
        root.style.left = "auto";
        root.style.right = "auto";
        root.style.bottom = "auto";
        root.style.height = "auto";
        root.style.minHeight = "100vh";
        root.style.overflow = "visible";
      }
    } else {
      // Restaurar comportamiento móvil si el viewport cambia de tamaño
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      if (root) {
        root.style.cssText = "";
      }
    }
  }, [isDesktop]);

  // ── Overlays compartidos (notif, búsqueda, trash) ──────────────
  const overlays = (
    <>
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
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <AppProvider data={shell.appData} setters={shell.appSetters} derived={shell.appDerived}>
        {!shell.isOnline && <OfflineBanner />}
        {/* Este div NO usa .appRoot — tiene su propia estructura para escritorio */}
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            background: T.bg,
            color: T.text,
            fontFamily: "'DM Sans', sans-serif",
            position: "relative",
          }}
        >
          {/* ── Sidebar fija a la izquierda ── */}
          <DesktopSidebar
            onTabClick={shell.handleTabClick}
            onTrashOpen={() => shell.setTrashOpen(true)}
            userName={shell.userName}
            userInitials={shell.userInitials}
            trashCount={shell.trashCount}
            showProfile={shell.showProfile}
          />

          {/* ── Columna principal (header + contenido scrollable) ── */}
          <div className={styles.desktopMain}>
            <AppHeader
              title={shell.showProfile ? "Perfil" : (shell.pageTitle === "Inicio" ? "Inicio" : "")}
              user={user}
              userName={shell.userName}
              onProfileClick={() => shell.handleTabClick("/perfil")}
              onSearchClick={() => shell.setGlobalSearch(true)}
              onNotifClick={() => shell.setNotifOpen(v => !v)}
              notifCount={shell.notifCount}
              headerColor={shell.headerColor}
              headerDark={shell.headerDark}
              onDrawerClick={() => {}}
              showProfile={shell.showProfile}
              isDesktop={true}
            />
            <div className={styles.desktopContent}>
              {shell.showProfile ? (
                <div style={{ padding: "0 0 40px" }}>
                  <ProfileView
                    user={user}
                    userName={shell.userName}
                    gastos={shell.appData.gastos}
                    confirmLogout={shell.confirmLogout}
                    setConfirmLogout={shell.setConfirmLogout}
                    onLogout={shell.handleLogout}
                  />
                </div>
              ) : (
                <AppRouter
                  userName={shell.userName}
                  autoScan={shell.autoScan}
                  setAutoScan={shell.setAutoScan}
                  onModalChange={shell.setAnyModalOpen}
                />
              )}
            </div>
          </div>
        </div>
        {overlays}
      </AppProvider>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // MOBILE LAYOUT (sin cambios — exactamente igual que antes)
  // ══════════════════════════════════════════════════════════════
  return (
    <AppProvider data={shell.appData} setters={shell.appSetters} derived={shell.appDerived}>
      {!shell.isOnline && <OfflineBanner />}
      <div className={styles.appRoot} style={{ background: T.bg, color: T.text }}>
        <AppHeader
          title={shell.showProfile ? "Perfil" : (shell.pageTitle === "Inicio" ? "Inicio" : "")}
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

        {shell.showProfile && (
          <main
            ref={shell.scrollRef}
            data-scroll
            style={{
              flex: 1, minHeight: 0,
              overflowY: "scroll", overflowX: "hidden",
              overscrollBehavior: "none",
              background: "var(--app-bg)",
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

        {!shell.showProfile && (
          <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: "var(--app-bg)" }}>
            <div
              ref={shell.scrollRef}
              data-scroll
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: "var(--keyboard-height, 0px)",
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
            headerDark={shell.headerDark}
          />
        )}

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
      </div>
      {overlays}
    </AppProvider>
  );
}

// ══════════════════════════════════════════════════════════════════
// AppShell
// ══════════════════════════════════════════════════════════════════
const INITIAL_HEADER_COLOR = "#0E1A3B";

function AppShell() {
  useViewportSetup();

  useEffect(() => {
    const cover = document.createElement("div");
    cover.setAttribute("aria-hidden", "true");
    cover.style.cssText =
      "position:fixed;inset:0;z-index:9998;opacity:0;pointer-events:none;" +
      "transition:none;overflow:hidden;" +
      "background:linear-gradient(170deg,#07101F 0%,#0D1629 55%,#111E35 100%);";
    const img = document.createElement("img");
    img.src = "/logo.png";
    img.decoding = "sync";
    img.setAttribute("aria-hidden", "true");
    img.style.cssText =
      "position:absolute;top:38%;left:50%;width:310px;display:block;" +
      "transform:translate(-50%,-50%);" +
      "filter:drop-shadow(0 0 28px rgba(37,99,235,.32));";
    cover.appendChild(img);
    document.body.appendChild(cover);
    const onVisibility = () => {
      if (document.hidden) {
        cover.style.transition = "none";
        cover.style.opacity = "1";
      } else {
        requestAnimationFrame(() => {
          cover.style.transition = "opacity 0.15s ease-out";
          cover.style.opacity = "0";
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cover.remove();
    };
  }, []);

  const [locked, setLocked] = useState(!sessionStorage.getItem("v360-session"));
  const [splash, setSplash] = useState(true);
  const [loginRevealing, setLoginRevealing] = useState(false);
  const loginLogoRectRef = useRef<DOMRect | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseDown, setFbDown] = useState(false);
  const [coverDone, setCoverDone] = useState(true);
  const authReadyRef = useRef(false);
  const splashWaiting = useRef(false);

  useEffect(() => {
    const lockScroll = () => {
      if (window.innerWidth >= 1024) return; // escritorio: no bloquear scroll
      const el = document.activeElement as HTMLElement | null;
      const editing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!editing && window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const vv = window.visualViewport;
    const scrollInputIntoView = (delay = 0) => {
      const focused = document.activeElement as HTMLElement | null;
      if (!focused) return;
      if (focused.tagName !== "INPUT" && focused.tagName !== "TEXTAREA" && !focused.isContentEditable) return;
      const doScroll = () => {
        const vvH = vv?.height ?? window.innerHeight;
        const rect = focused.getBoundingClientRect();
        if (rect.bottom <= vvH - 8 && rect.top >= 56) return;
        try { focused.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {/* */}
        let parent = focused.parentElement;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          const isScrollable = style.overflow === "auto" || style.overflow === "scroll" || style.overflowY === "auto" || style.overflowY === "scroll";
          if (isScrollable) {
            const pRect = parent.getBoundingClientRect();
            const visibleBottom = Math.min(vvH, pRect.bottom);
            if (rect.bottom > visibleBottom - 8) parent.scrollTop += rect.bottom - visibleBottom + 80;
            else if (rect.top < pRect.top + 56) parent.scrollTop -= pRect.top + 56 - rect.top;
            break;
          }
          parent = parent.parentElement;
        }
      };
      if (delay > 0) setTimeout(doScroll, delay);
      else doScroll();
    };
    const updateKbHeight = () => {
      const h = vv ? Math.max(0, window.innerHeight - vv.height - (vv.offsetTop ?? 0)) : 0;
      document.documentElement.style.setProperty("--keyboard-height", `${h}px`);
      if (h > 100) scrollInputIntoView(80);
    };
    const onFocusin = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) return;
      scrollInputIntoView(300);
      scrollInputIntoView(500);
      scrollInputIntoView(750);
    };
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    updateKbHeight();
    lockScroll();
    window.addEventListener("scroll", lockScroll, { passive: true });
    vv?.addEventListener("resize", updateKbHeight, { passive: true });
    document.addEventListener("focusin", onFocusin as EventListener);
    return () => {
      document.removeEventListener("touchstart", noop);
      window.removeEventListener("scroll", lockScroll);
      vv?.removeEventListener("resize", updateKbHeight);
      document.removeEventListener("focusin", onFocusin as EventListener);
    };
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => {
      authReadyRef.current = true; setAuthReady(true); setFbDown(true);
      if (splashWaiting.current) { splashWaiting.current = false; setSplash(false); }
    }, 10_000);
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(auth, u => {
        clearTimeout(fallback); setFbDown(false);
        if (u && ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(u.email ?? "")) {
          signOut(auth); setUser(null);
        } else {
          setUser(u);
          if (u) { prefetchAllTabs(); preloadData().catch(() => {}); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); }
        }
        authReadyRef.current = true; setAuthReady(true);
        if (splashWaiting.current) { splashWaiting.current = false; setSplash(false); }
      }, err => {
        console.error("[Auth] error:", err); clearTimeout(fallback); setFbDown(true);
        authReadyRef.current = true; setAuthReady(true);
        if (splashWaiting.current) { splashWaiting.current = false; setSplash(false); }
      });
    } catch (err) {
      console.error("[Auth] Firebase init error:", err); clearTimeout(fallback); setFbDown(true);
      authReadyRef.current = true; setAuthReady(true);
      if (splashWaiting.current) { splashWaiting.current = false; setSplash(false); }
    }
    return () => { clearTimeout(fallback); unsub?.(); };
  }, []);

  useEffect(() => {
    const emergency = setTimeout(() => { setSplash(false); }, 8000);
    return () => clearTimeout(emergency);
  }, []);

  useEffect(() => {
    if (!splash) {
      const color = (!user || locked) ? "#07101F" : INITIAL_HEADER_COLOR;
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", color);
      document.documentElement.style.background = color;
      document.body.style.background = color;
    }
  }, [splash, user, locked]);

  return (
    <ToastProvider>
      {splash && <div style={{ position: "fixed", inset: 0, background: "#07101F", zIndex: 998, pointerEvents: "none" }} />}
      {!splash && !authReady && <div key="post-splash-cover" style={{ position: "fixed", inset: 0, background: "#07101F", zIndex: 997, pointerEvents: "none" }} />}
      {!splash && authReady && !coverDone && (
        <div key="post-auth-cover" style={{ position: "fixed", inset: 0, background: INITIAL_HEADER_COLOR, zIndex: 997, pointerEvents: "none", animation: "coverFade 0.3s ease-out forwards" }} onAnimationEnd={() => setCoverDone(true)} />
      )}
      <style>{`@keyframes coverFade { from { opacity:1 } to { opacity:0; } }`}</style>

      {splash && (
        <Splash
          getLoginLogoRect={() => loginLogoRectRef.current}
          onReveal={() => setLoginRevealing(true)}
          done={() => { setSplash(false); setLoginRevealing(false); if (!authReadyRef.current) splashWaiting.current = true; }}
        />
      )}

      {!splash && !authReady && (
        <div style={{ position: "fixed", inset: 0, background: "#07101F", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "env(safe-area-inset-top)" }}>
          <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.8)", borderRadius: "50%", animation: "v360spin 0.8s linear infinite" }} />
          <style>{`@keyframes v360spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {authReady && (!user || locked) && (
        <>
          {!splash && firebaseDown && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "#7f1d1d", color: "#fecaca", padding: "10px 20px", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
              ⚠️ Sin conexión a Firebase — verifica tu red o intenta más tarde
            </div>
          )}
          <LoginScreen
            onLogoReady={(rect) => { loginLogoRectRef.current = rect; }}
            splashActive={!loginRevealing && splash}
            onLoginSuccess={(u: User) => { setCoverDone(false); setUser(u); setLocked(false); }}
          />
        </>
      )}

      {!splash && !!user && !locked && (
        <ShellErrorBoundary>
          <AuthenticatedShell user={user} onLogout={() => { signOut(auth).catch(()=>{}); setUser(null); setLocked(true); sessionStorage.removeItem("v360-session"); }} />
        </ShellErrorBoundary>
      )}
    </ToastProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
