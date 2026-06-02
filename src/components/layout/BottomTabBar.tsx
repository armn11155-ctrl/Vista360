import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T } from "../../config/theme";
import { NAV_TAB_IDS } from "../../config/constants";

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

// ── CSS del glass — mismo efecto que 8 Millas / Cyber ─────────────
const GLASS_CSS = `
  .v360-btm-glass {
    position: relative;
    background: linear-gradient(
      160deg,
      rgba(255,255,255,0.07) 0%,
      rgba(255,255,255,0.03) 50%,
      rgba(255,255,255,0.05) 100%
    ) !important;
    backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255,255,255,0.38) !important;
    box-shadow:
      0 6px 24px rgba(0,0,0,0.35),
      0 2px 6px rgba(0,0,0,0.2),
      inset 0px 4px 12px rgba(255,255,255,0.8),
      inset 0px -3px 8px rgba(0,0,0,0.18),
      inset 2px 0px 6px rgba(255,255,255,0.15) !important;
    overflow: hidden;
    isolation: isolate;
    transition: all 0.2s cubic-bezier(0.25,0.46,0.45,0.94) !important;
    color: #fff !important;
  }
  /* Shimmer iridiscente azul→magenta */
  .v360-btm-glass::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(99,179,255,0.13) 0%,
      rgba(168,100,255,0.09) 45%,
      rgba(255,100,180,0.06) 75%,
      transparent 100%
    );
    border-radius: inherit;
    pointer-events: none;
    z-index: 0;
  }
  /* Franja especular blanca en canto superior */
  .v360-btm-glass::after {
    content: "";
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 2px;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255,255,255,0.9) 30%,
      rgba(255,255,255,1) 50%,
      rgba(255,255,255,0.9) 70%,
      transparent 100%
    );
    filter: blur(0.5px);
    pointer-events: none;
    z-index: 0;
  }
  /* Contenido del botón encima del shimmer */
  .v360-btm-glass > * {
    position: relative;
    z-index: 1;
  }
`;

/**
 * Barra de navegación inferior de la PWA.
 * Extraído de AuthenticatedShell — reduce ~120 líneas de JSX inline.
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
    <>
      <style>{GLASS_CSS}</style>
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
            // Fondo oscuro — necesario para que el glass tenga contraste
            background: "#0D1629",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 28,
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
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
                      background: T.accent,
                      border: "3px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(37,99,235,0.55), 0 2px 8px rgba(37,99,235,0.3)",
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
                className={active ? "v360-btm-glass" : undefined}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  background: "transparent",
                  border: "1px solid transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.38)",
                  padding: "6px 4px",
                  minHeight: 48,
                  borderRadius: 18,
                  margin: "0 2px",
                  transition: "color 0.18s ease",
                  cursor: "pointer",
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
    </>
  );
}
