import { useCallback, useRef, useLayoutEffect, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_TAB_IDS } from "../../config/constants";
import { HEADER_COLORS } from "../../hooks/useHeaderShell";
import { T } from "../../config/theme";
// ── Actualiza theme-color en el event handler del click ───────────────
// Corre antes de que React re-renderice, garantizando que el status bar
// cambie en el mismo instante que el gesto del usuario.
function applyThemeColorNow(routePath: string): void {
  const color = HEADER_COLORS[routePath] ?? T.bg;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
  document.documentElement.style.background = color;
  document.body.style.background = color;
}


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
  /**
   * Valor inicial por ruta (de useHeaderShell).
   * Se usa como punto de partida; el detector en tiempo real lo sobreescribe
   * frame a frame según la luminancia real del contenido detrás de la barra.
   */
  headerDark?: boolean;
}

// ── CSS cristal líquido — glass upgrade con squish direction-aware ───
const GLASS_CSS = `
  /* ── Variables de reflex para tema oscuro de Vista360 ── */
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

// ── Lee la luminancia real del contenido justo detrás de la barra ──
// Usa elementsFromPoint en el centro superior de la zona de la barra,
// ignora la barra misma y los nodos raíz, y devuelve true si es oscuro.
function sampleLuminanceBehindBar(): boolean | null {
  // Punto de muestreo: centro horizontal, ~68px desde abajo
  // (justo dentro del área donde la barra es transparente)
  const x = window.innerWidth / 2;
  const y = window.innerHeight - 68;

  const els = document.elementsFromPoint(x, y);

  for (const el of els) {
    // Saltar la propia barra de navegación y sus hijos
    if (el.closest?.(".v360-bar")) continue;
    // Saltar html/body (sus backgrounds los maneja useHeaderShell)
    if (el === document.documentElement || el === document.body) continue;

    const bg = window.getComputedStyle(el).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;

    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const lum =
        (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) /
        255;
      return lum < 0.5; // true = oscuro
    }
  }

  return null; // no se encontró fondo opaco
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
  // Arranca con el valor por ruta y se actualiza en cada scroll frame.
  const [onDark, setOnDark] = useState<boolean>(headerDark);
  // Ref para el debounce de detección «claro» en /contratos
  const lightDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Función de muestreo estable (sin deps externas — lee el DOM en vivo)
  const sample = useCallback(() => {
    const result = sampleLuminanceBehindBar();
    if (result === null) return;

    if (pathname === "/contratos") {
      // En /contratos: oscuro = aplicar YA, cancelar cualquier timer pendiente.
      // Claro = esperar 400ms antes de cambiar (evita flicker por elementos
      // blancos dentro de tarjetas oscuras que pasan brevemente por la barra).
      // Solo el fondo blanco real — donde el usuario se detiene — dispara el cambio.
      if (result === true) {
        if (lightDebounce.current) {
          clearTimeout(lightDebounce.current);
          lightDebounce.current = null;
        }
        setOnDark(true);
      } else {
        if (!lightDebounce.current) {
          lightDebounce.current = setTimeout(() => {
            setOnDark(false);
            lightDebounce.current = null;
          }, 400);
        }
      }
      return;
    }

    setOnDark(result);
  }, [pathname, lightDebounce]);

  // Al cambiar de ruta: limpiar debounce, resetear y muestrear
  useEffect(() => {
    // Limpiar el debounce de contratos al cambiar de ruta
    if (lightDebounce.current) {
      clearTimeout(lightDebounce.current);
      lightDebounce.current = null;
    }
    setOnDark(headerDark);
    const raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [pathname, headerDark, sample]);

  // Listener de scroll con RAF throttle — activo toda la vida del componente
  useEffect(() => {
    let rafId: number | null = null;

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        sample();
        rafId = null;
      });
    };

    // capture:true → captura scroll de cualquier contenedor anidado
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [sample]);

  // Colores resultantes — transición CSS suaviza el cambio
  const iconColor = onDark ? "#ffffff" : "#0E1A3B";
  const iconColorMuted = onDark
    ? "rgba(255,255,255,0.55)"
    : "rgba(14,26,59,0.45)";

  // ── Pill + squish ──────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );
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
      const dir =
        currentIdx > prevIdx ? "v360-pill--right" : "v360-pill--left";
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
                <div
                  key="add"
                  style={{ flex: 1, display: "flex", justifyContent: "center" }}
                >
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
                      boxShadow:
                        "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
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
                onClick={() => {
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
                  color: active ? iconColor : iconColorMuted,
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


