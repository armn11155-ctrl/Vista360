import { useCallback, useRef, useLayoutEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

// ── CSS del glass — pill azul oscuro + efectos glass completos ───
// El pill tiene su propio fondo azul oscuro: el backdrop-filter
// difumina el blanco de la barra detras, y el shimmer + franja
// especular blanca contrastan perfectamente sobre el azul.
const GLASS_CSS = `
  .v360-pill {
    position: absolute;
    top: 6px;
    height: calc(100% - 12px);
    border-radius: 18px;
    background: linear-gradient(
      160deg,
      rgba(13,26,60,0.97) 0%,
      rgba(10,20,48,0.96) 50%,
      rgba(13,26,60,0.97) 100%
    );
    backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(20px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255,255,255,0.38);
    box-shadow:
      0 6px 24px rgba(13,26,60,0.6),
      0 2px 8px rgba(0,0,0,0.18),
      inset 0px 4px 12px rgba(255,255,255,0.22),
      inset 0px -3px 8px rgba(0,0,0,0.18),
      inset 2px 0px 6px rgba(255,255,255,0.12);
    overflow: hidden;
    pointer-events: none;
    transition:
      left 0.38s cubic-bezier(0.34, 1.4, 0.64, 1),
      width 0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  /* Shimmer iridiscente azul→magenta sobre el azul del pill */
  .v360-pill::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(99,179,255,0.20) 0%,
      rgba(168,100,255,0.13) 45%,
      rgba(255,100,180,0.08) 75%,
      transparent 100%
    );
    border-radius: inherit;
    pointer-events: none;
  }
  /* Franja especular blanca en canto superior */
  .v360-pill::after {
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
  }
`;

export function BottomTabBar({
  tabs,
  icons,
  showProfile,
  onTabClick,
  onAddClick,
}: BottomTabBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Refs para medir posiciones reales de cada botón nav
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Posicion del pill deslizante
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);

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

  // Medir el botón activo y mover el pill a su posición exacta
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeTab = tabs.find(t => {
      if (t.id === "__add__") return false;
      const route = t.id === "hoy" ? "/" : `/${t.id}`;
      return !showProfile && pathname === route;
    });
    if (!activeTab) return;

    const btn = btnRefs.current[activeTab.id];
    if (!btn) return;

    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();

    setPill({
      left: bRect.left - cRect.left,
      width: bRect.width,
    });
    // Primer render: mostrar sin animación, luego activar transición
    requestAnimationFrame(() => setPillReady(true));
  }, [pathname, showProfile, tabs]);

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
          ref={containerRef}
          role="tablist"
          aria-label="Navegación principal"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            padding: "6px 6px",
            maxWidth: 480,
            margin: "0 auto",
            pointerEvents: "auto",
            background: "#FFFFFF",
            border: "1px solid rgba(229,231,235,0.9)",
            borderRadius: 28,
            boxShadow: "0 8px 28px rgba(15,23,41,0.12), 0 2px 8px rgba(15,23,41,0.06)",
          }}
        >
          {/* ── Pill deslizante — se mueve entre tabs ── */}
          {pill && (
            <div
              className="v360-pill"
              style={{
                left: pill.left,
                width: pill.width,
                // Sin transición en el primer frame para evitar slide desde 0
                transition: pillReady
                  ? undefined // usa la transición del CSS
                  : "none",
              }}
            />
          )}

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
                      background: "#0E1A3B",
                      border: "3px solid rgba(255,255,255,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
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
                ref={el => {
                  btnRefs.current[t.id] = el;
                }}
                role="tab"
                aria-selected={active}
                aria-label={t.label}
                tabIndex={active ? 0 : -1}
                onClick={() => onTabClick(routePath)}
                onKeyDown={e => handleKeyDown(e, t.id)}
                style={{
                  position: "relative",
                  zIndex: 1, // encima del pill
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  background: "transparent",
                  border: "none",
                  color: active ? "#ffffff" : "#94A3B8",
                  padding: "6px 4px",
                  minHeight: 48,
                  borderRadius: 18,
                  margin: "0 2px",
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                }}
              >
                <div
                  style={{
                    transition: "transform 0.28s cubic-bezier(.34,1.56,.64,1)",
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
