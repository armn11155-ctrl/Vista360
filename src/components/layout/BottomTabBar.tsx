import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T } from "../../config/theme";

interface Tab {
  id: string;
  label: string;
}

interface BottomTabBarProps {
  tabs: Tab[];
  icons: Record<string, React.ReactNode>;
  showProfile: boolean;
  onTabClick: (path: string) => void;
  onAddClick: () => void;
}

const NAV_TAB_IDS = ["hoy", "paneles", "contratos", "gastos", "capital", "reportes", "mapa"];

/**
 * Barra de navegación inferior de la PWA.
 * Extraído de AuthenticatedShell para reducir su tamaño.
 */
export function BottomTabBar({
  tabs,
  icons,
  showProfile,
  onTabClick,
  onAddClick,
}: BottomTabBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const idx = NAV_TAB_IDS.indexOf(tabId);
      if (idx === -1) return;
      const next =
        e.key === "ArrowRight"
          ? NAV_TAB_IDS[(idx + 1) % NAV_TAB_IDS.length]
          : NAV_TAB_IDS[(idx - 1 + NAV_TAB_IDS.length) % NAV_TAB_IDS.length];
      navigate(next === "hoy" ? "/" : `/${next}`);
    },
    [navigate],
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 4px)",
        left: 12,
        right: 12,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        role="tablist"
        aria-label="Navegación principal"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 6px",
          maxWidth: 480,
          margin: "0 auto",
          pointerEvents: "auto",
          background: T.white,
          border: "1px solid rgba(229,231,235,0.9)",
          borderRadius: 28,
          boxShadow: "0 8px 28px rgba(15,23,41,0.14), 0 2px 8px rgba(15,23,41,0.06)",
        }}
      >
        {tabs.map(t => {
          if (t.id === "__add__") {
            return (
              <div key="add" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <button
                  aria-label="Registrar gasto rápido"
                  onClick={onAddClick}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "linear-gradient(180deg,#0E1A3B 0%,#15265A 100%)",
                    border: "3px solid rgba(255,255,255,0.95)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(37,99,235,0.42), 0 2px 8px rgba(37,99,235,0.2)",
                    marginTop: -28,
                    cursor: "pointer",
                  }}
                >
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          }

          const routePath = t.id === "hoy" ? "/" : `/${t.id}`;
          const active = !showProfile && pathname === routePath;

          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-label={t.label}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabClick(routePath)}
              onKeyDown={e => handleKeyDown(e, t.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                background: active ? "rgba(37,99,235,0.08)" : "none",
                border: "none",
                color: active ? T.accent : "#9CA3AF",
                padding: "6px 4px",
                minHeight: 48,
                borderRadius: 18,
                margin: "0 2px",
                transition: "background 0.18s ease, color 0.18s ease",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1)",
                  transform: active ? "scale(1.12)" : "scale(1)",
                }}
              >
                {icons[t.id]}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: active ? "0.01em" : 0,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
