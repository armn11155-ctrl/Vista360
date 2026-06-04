import { useCallback, useRef, useLayoutEffect, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_TAB_IDS } from "../../config/constants";
import { HEADER_COLORS } from "../../hooks/useHeaderShell";
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
  /** Valor inicial por ruta (de useHeaderShell). El detector en tiempo real lo sobreescribe. */
  headerDark?: boolean;
}

const GLASS_CSS = `
  .v360-bar {
    --rl: 0.4;
    --rd: 1.8;
    --cg: 122, 150, 200;
    --cl: 255, 255, 255;
    --cd: 0, 0, 0;
  }

  .v360-pill {
    position: absolute;
    top: 6px;
    height: calc(100% - 12px);
    border-radius: 18px;
    pointer-events: none;
    background: linear-gradient(
      rgba(122, 150, 200, 0.18),
      rgba(122, 150, 200, 0.10)
    );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,0.07),
      inset 1.8px 3px 0px -2px rgba(255,255,255,0.36),
      inset -2px -2px 0px -2px rgba(255,255,255,0.32),
      inset -3px -8px 1px -6px rgba(255,255,255,0.24),
      inset -0.3px -1px 4px 0px rgba(0,0,0,0.32),
      inset -1.5px 2.5px 0px -2px rgba(0,0,0,0.36),
      inset 0px 3px 4px -2px rgba(0,0,0,0.36),
      inset 2px -6.5px 1px -4px rgba(0,0,0,0.18),
      0px 1px 5px rgba(0,0,0,0.30),
      0px 8px 24px rgba(0,0,0,0.28);
    transition:
      left   0.38s cubic-bezier(0.34, 1.4, 0.64, 1),
      width  0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  .v360-pill--right {
    transform-origin: left center;
    animation: v360SquishRight 420ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .v360-pill--left {
    transform-origin: right center;
    animation: v360SquishLeft 420ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  @keyframes v360SquishRight {
    0%   { scale: 1    1; }
    40%  { scale: 1.18 1; }
    100% { scale: 1    1; }
  }

  @keyframes v360SquishLeft {
    0%   { scale: 1    1; }
    40%  { scale: 1.18 1; }
    100% { scale: 1    1; }
  }
`;

const BAR_BOX_SHADOW = [
  "inset 0 0 0 1px rgba(255,255,255,0.07)",
  "inset 1.8px 3px 0px -2px rgba(255,255,255,0.36)",
  "inset -2px -2px 0px -2px rgba(255,255,255,0.32)",
  "inset -3px -8px 1px -6px rgba(255,255,255,0.24)",
  "inset -0.3px -1px 4px 0px rgba(0,0,0,0.32)",
  "inset -1.5px 2.5px 0px -2px rgba(0,0,0,0.36)",
  "inset 0px 3px 4px -2px rgba(0,0,0,0.36)",
  "inset 2px -6.5px 1px -4px rgba(0,0,0,0.18)",
  "0px 1px 5px rgba(0,0,0,0.30)",
  "0px 8px 24px rgba(0,0,0,0.28)",
].join(", ");

// ── Actualiza theme-color ANTES de que React re-renderice ──────────
// Llamado en el event handler del click, no en un efecto —
// así el status bar cambia en el mismo frame que el gesto del usuario.
function applyThemeColorNow(routePath: string) {
  const color = HEADER_COLORS[routePath] ?? T.bg;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
  document.documentElement.style.background = color;
  document.body.style.background = color;
}

// ── Luminancia en un punto del DOM ─────────────────────────────────
function getLuminanceAt(x: number, y: number): number | null {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.closest?.(".v360-bar")) continue;
    if (el === document.documentElement) continue;
    const bg = window.getComputedStyle(el).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return (
        (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) /
        255
      );
    }
  }
  return null;
}

// ── Muestreo en 3 puntos + mediana ────────────────────────────────
// Los bordes (x=8, x=w-8) quedan fuera de la barra (left:12) y
// generalmente fuera del margen de las tarjetas → leen el fondo real.
// Mediana: una tarjeta blanca en centro no puede ganar si los lados son oscuros.
function sampleLuminanceBehindBar(): boolean | null {
  const y = window.innerHeight - 68;
  const w = window.innerWidth;

  const samples: number[] = [
    getLuminanceAt(8, y),
    getLuminanceAt(w / 2, y),
    getLuminanceAt(w - 8, y),
  ].filter((v): v is number => v !== null);

  if (samples.length === 0) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]! < 0.5;
}

export function BottomTabBar({
  tabs,
  icons,
  showProfile,
  onTabClick,
  onAddClick,
  headerDark = true,
}: BottomTabBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // ── Estado de luminancia dinámica ──────────────────────────────────
  const [onDark, setOnDark] = useState<boolean>(headerDark);

  const sample = useCallback(() => {
    const result = sampleLuminanceBehindBar();
    if (result !== null) setOnDark(result);
  }, []);

  useEffect(() => {
    setOnDark(headerDark);
    const raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [pathname, headerDark, sample]);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => { sample(); rafId = null; });
    };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [sample]);

  // ── Colores ────────────────────────────────────────────────────────
  //
  // ACTIVO: adaptativo — blanco en fondo oscuro, azul oscuro en fondo claro.
  //
  // INACTIVO: siempre azul oscuro (no adaptativo), independiente del fondo.
  //   • Resto de tabs: rgba(14,26,59,0.52) — azul oscuro semi-transparente
  //   • Inicio (hoy): rgba(14,26,59,0.80) — un poco más oscuro, como pidió el usuario
  //
  const iconColorActive     = onDark ? "#ffffff" : "#0E1A3B";
  const iconColorInactive   = "rgba(14,26,59,0.52)";   // todos los inactivos
  const iconColorInactiveHome = "rgba(14,26,59,0.80)"; // inicio — más oscuro

  // ── Pill + squish ──────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);
  const prevIdxRef = useRef<number>(-1);
  const [squishClass, setSquishClass] = useState("");

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
      navigate(next === "hoy" ? "/" : `/${next}`, { replace: true });
    },
    [navigate],
  );

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
    setPill({ left: bRect.left - cRect.left, width: bRect.width });

    const currentIdx = NAV_TAB_IDS.indexOf(activeTab.id);
    const prevIdx = prevIdxRef.current;

    if (pillReady && prevIdx !== -1 && prevIdx !== currentIdx) {
      const dir = currentIdx > prevIdx ? "v360-pill--right" : "v360-pill--left";
      setSquishClass(dir);
      const t = setTimeout(() => setSquishClass(""), 440);
      return () => clearTimeout(t);
    }

    prevIdxRef.current = currentIdx;
    requestAnimationFrame(() => setPillReady(true));
  }, [pathname, showProfile, tabs, pillReady]);

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
          className="v360-bar"
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
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            background:
              "linear-gradient(rgba(var(--cg,122,150,200),0.14), rgba(var(--cg,122,150,200),0.08))",
            borderRadius: 28,
            border: "none",
            boxShadow: BAR_BOX_SHADOW,
          }}
        >
          {pill && (
            <div
              className={`v360-pill${squishClass ? " " + squishClass : ""}`}
              style={{
                left: pill.left,
                width: pill.width,
                transition: pillReady ? undefined : "none",
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

            // Color inactivo: inicio más oscuro que el resto
            const inactiveColor =
              t.id === "hoy" ? iconColorInactiveHome : iconColorInactive;

            return (
              <button
                key={t.id}
                ref={el => { btnRefs.current[t.id] = el; }}
                role="tab"
                aria-selected={active}
                aria-label={t.label}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  // ── Actualizar theme-color ANTES del re-render de React ──
                  // Garantiza que status bar y header cambien en el mismo frame.
                  applyThemeColorNow(routePath);
                  onTabClick(routePath);
                }}
                onKeyDown={e => handleKeyDown(e, t.id)}
                style={{
                  position: "relative",
                  zIndex: 1,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  background: "transparent",
                  border: "none",
                  color: active ? iconColorActive : inactiveColor,
                  padding: "6px 4px",
                  minHeight: 48,
                  borderRadius: 18,
                  margin: "0 2px",
                  cursor: "pointer",
                  transition: "color 0.22s ease",
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
