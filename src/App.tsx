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
import { prefetchAllTabs, AppRouter } from "./components/layout/AppRouter";
import { preloadData } from "./services/firestore";
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
      <div className={styles.appRoot} style={{ background: T.dark, color: T.text }}>
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
  // Ref para evitar stale closure en el done() del splash
  const authReadyRef = useRef(false);
  // true cuando la animación del splash terminó pero auth aún no llegó
  const splashWaiting = useRef(false);

  useEffect(() => {
    // ── Bloquear window.scroll solo si NO hay input activo ────────────
    const lockScroll = () => {
      const el = document.activeElement as HTMLElement | null;
      const editing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!editing && window.scrollY !== 0) window.scrollTo(0, 0);
    };

    const vv = window.visualViewport;

    // ── Sube el input enfocado para que sea visible por encima del teclado ──
    // Funciona tanto para el área de scroll principal como para modales.
    // Busca el contenedor scrollable más cercano y lo desplaza manualmente.
    const scrollInputIntoView = (delay = 0) => {
      const focused = document.activeElement as HTMLElement | null;
      if (!focused) return;
      if (
        focused.tagName !== "INPUT" &&
        focused.tagName !== "TEXTAREA" &&
        !focused.isContentEditable
      ) return;

      const doScroll = () => {
        const vvH = vv?.height ?? window.innerHeight;
        const rect = focused.getBoundingClientRect();

        // Si el campo ya es visible, no hacer nada
        if (rect.bottom <= vvH - 8 && rect.top >= 56) return;

        // 1. Intentar scrollIntoView (funciona en la mayoría de casos)
        try {
          focused.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {/* silenciar */}

        // 2. Fallback manual: buscar el contenedor overflow y desplazarlo
        let parent = focused.parentElement;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          const isScrollable =
            style.overflow === "auto" || style.overflow === "scroll" ||
            style.overflowY === "auto" || style.overflowY === "scroll";
          if (isScrollable) {
            const pRect = parent.getBoundingClientRect();
            const visibleBottom = Math.min(vvH, pRect.bottom);
            if (rect.bottom > visibleBottom - 8) {
              parent.scrollTop += rect.bottom - visibleBottom + 80;
            } else if (rect.top < pRect.top + 56) {
              parent.scrollTop -= pRect.top + 56 - rect.top;
            }
            break;
          }
          parent = parent.parentElement;
        }
      };

      if (delay > 0) setTimeout(doScroll, delay);
      else doScroll();
    };

    // ── Teclado virtual: actualizar --keyboard-height y subir input ───
    const updateKbHeight = () => {
      const h = vv
        ? Math.max(0, window.innerHeight - vv.height - (vv.offsetTop ?? 0))
        : 0;
      document.documentElement.style.setProperty("--keyboard-height", `${h}px`);
      // Cuando el teclado termina de aparecer (h > 100), subir el input
      if (h > 100) scrollInputIntoView(80);
    };

    // ── Al enfocar un input: intentar subir en varios momentos ────────
    // (el teclado puede tardar 300-600ms en terminar de abrirse en iOS)
    const onFocusin = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (
        el.tagName !== "INPUT" &&
        el.tagName !== "TEXTAREA" &&
        !el.isContentEditable
      ) return;
      // Tres intentos escalonados para capturar el momento exacto
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
      authReadyRef.current = true;
      setAuthReady(true);
      setFbDown(true);
      if (splashWaiting.current) {
        splashWaiting.current = false;
        setSplash(false);
      }
    }, 2000); // Reducido 3000→2000ms: auth de Firebase cached llega en <300ms normalmente
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
              // Calentar caché de Firestore durante el splash → sin flash de carga al montar
              preloadData().catch(() => {});
              if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
              }
            }
          }
          authReadyRef.current = true;
          setAuthReady(true);
          if (splashWaiting.current) {
            splashWaiting.current = false;
            setSplash(false);
          }
        },
        err => {
          console.error("[Auth] error:", err);
          clearTimeout(fallback);
          setFbDown(true);
          authReadyRef.current = true;
          setAuthReady(true);
          if (splashWaiting.current) {
            splashWaiting.current = false;
            setSplash(false);
          }
        },
      );
    } catch (err) {
      console.error("[Auth] Firebase init error:", err);
      clearTimeout(fallback);
      setFbDown(true);
      authReadyRef.current = true;
      setAuthReady(true);
      if (splashWaiting.current) {
        splashWaiting.current = false;
        setSplash(false);
      }
    }
    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, []);

  // ── Safety net: si splash no llama done() en 8s, forzar salida ──
  useEffect(() => {
    const emergency = setTimeout(() => {
      setSplash(false);
    }, 8000);
    return () => clearTimeout(emergency);
  }, []);

  return (
    <ToastProvider>
      {/* CSS global movido a src/index.css — ver refactor(styles) */}

      {/* Cover negro z-998: tapa el appRoot blanco mientras el Splash
           hace fade-out (opacity 1→0 expone lo que hay detrás) */}
      {splash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000",
            zIndex: 998,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Micro-cover: stays 200ms after splash ends to mask the mount flash */}
      {!splash && (
        <div
          key="post-splash-cover"
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000",
            zIndex: 997,
            pointerEvents: "none",
            animation: "coverFade 0.2s ease-out 0.05s both",
          }}
        />
      )}
      <style>{`@keyframes coverFade { from { opacity:1 } to { opacity:0 } }`}</style>

      {splash && (
        <Splash
          done={() => {
            // FIX: Siempre cerrar el splash — no esperar authReady.
            // El cover "!splash && !authReady" muestra un spinner hasta
            // que Firebase resuelva. Antes podía quedarse en negro infinito.
            setSplash(false);
            if (!authReadyRef.current) {
              splashWaiting.current = true;
            }
          }}
        />
      )}

      {!splash && !authReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: T.dark,
            zIndex: 998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Spinner — indica que Firebase está respondiendo, no que la app está rota */}
          <div style={{
            width: 36, height: 36,
            border: "3px solid rgba(255,255,255,0.15)",
            borderTopColor: "rgba(255,255,255,0.8)",
            borderRadius: "50%",
            animation: "v360spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes v360spin { to { transform: rotate(360deg); } }`}</style>
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



