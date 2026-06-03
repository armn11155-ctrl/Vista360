/**
 * SwipeTabWrapper — swipe horizontal con vista previa real del tab adyacente.
 *
 * Mientras el dedo arrastra:
 *   • El contenido actual sigue al dedo (translateX)
 *   • El tab anterior/siguiente aparece desde el lado opuesto
 * Al soltar:
 *   • Si supera el umbral → navega con animación de deslizamiento
 *   • Si no → rebota de vuelta (spring back)
 */
import {
  useRef, useState, useEffect, useCallback, lazy, Suspense,
  type RefObject, type Dispatch, type SetStateAction,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_TAB_IDS } from "../../config/constants";
import { TabSuspense } from "../shared/AppSkeletons";
import { useAppData, useAppSetters, useAppDerived } from "../../context/AppContext";

// Los mismos chunks que AppRouter — ya están prefetched al login
const ResumenNuevo = lazy(() => import("../features/dashboard/ResumenNuevo"));
const Paneles      = lazy(() => import("../features/paneles/Paneles"));
const Contratos    = lazy(() => import("../features/contratos/Contratos"));
const CRM          = lazy(() => import("../features/crm/CRM"));

// Fracción del ancho de pantalla necesaria para completar el swipe
const COMPLETE_RATIO = 0.38;
// Velocidad mínima (px/ms) para completar aunque no llegue al ratio
const VELOCITY_MIN = 0.28;
// Duración de la animación de snap (ms)
const ANIM_MS = 270;

/* ── Vista previa del tab adyacente ────────────────────────────── */
// Se renderiza sin interactividad (pointerEvents:none en el contenedor).
// Usa los datos del AppContext compartido → muestra el contenido real.
function TabPreview({ tabId }: { tabId: string }) {
  const { paneles, contratos, gastos, loading } = useAppData();
  const { contractsActive, clientesActive }     = useAppDerived();
  const { setPaneles, setContratos, setClientes } = useAppSetters();

  // No-ops: el preview no navega ni abre modales
  const noNav   = useCallback((_id: string) => {}, []);
  const noModal = useCallback<Dispatch<SetStateAction<boolean>>>(() => {}, []);

  switch (tabId) {
    case "hoy":
      return (
        <div className="tabPanel tabPadded">
          <Suspense fallback={<TabSuspense />}>
            <ResumenNuevo
              clientes={clientesActive} contratos={contratos}
              paneles={paneles} gastos={gastos}
              setTab={noNav} userName=""
            />
          </Suspense>
        </div>
      );
    case "paneles":
      return (
        <div className="tabPanel tabPadded">
          <Suspense fallback={<TabSuspense />}>
            <Paneles
              paneles={paneles} setPaneles={setPaneles}
              contratos={contratos} loading={loading}
              setTab={noNav} onModalChange={noModal}
            />
          </Suspense>
        </div>
      );
    case "contratos":
      return (
        <div className="tabPanel tabFlush">
          <Suspense fallback={<TabSuspense />}>
            <Contratos
              contratos={contratos} setContratos={setContratos}
              paneles={paneles} clientes={clientesActive}
              loading={loading} setTab={noNav} onModalChange={noModal}
            />
          </Suspense>
        </div>
      );
    case "crm":
      return (
        <div className="tabPanel tabPadded">
          <Suspense fallback={<TabSuspense />}>
            <CRM
              clientes={clientesActive} setClientes={setClientes}
              contratos={contractsActive} loading={loading}
              onModalChange={noModal}
            />
          </Suspense>
        </div>
      );
    default:
      return <TabSuspense />;
  }
}

/* ── Props ──────────────────────────────────────────────────────── */
interface SwipeTabWrapperProps {
  children: React.ReactNode;
  /** Ref del div con scroll — se lo pasamos para que useUIShell pueda hacer scrollTop=0 */
  scrollRef: RefObject<HTMLDivElement>;
  /** Desactiva el swipe cuando hay un modal/drawer abierto */
  disabled?: boolean;
}

/* ── Componente principal ────────────────────────────────────────── */
export function SwipeTabWrapper({ children, scrollRef, disabled }: SwipeTabWrapperProps) {
  const { pathname } = useLocation();
  const navigate     = useNavigate();

  // dragX: píxeles horizontales actuales (sigue al dedo en tiempo real)
  const [dragX, setDragX] = useState(0);
  // phase: idle | drag | complete | cancel
  const [phase, setPhase] = useState<"idle" | "drag" | "complete" | "cancel">("idle");

  const wrapRef  = useRef<HTMLDivElement>(null);
  const startX   = useRef(0);
  const startY   = useRef(0);
  const startT   = useRef(0);
  const dirRef   = useRef<"h" | "v" | null>(null);

  const currentId  = pathname === "/" ? "hoy" : pathname.replace(/^\//, "");
  const currentIdx = NAV_TAB_IDS.indexOf(currentId);
  const prevId     = currentIdx > 0                        ? NAV_TAB_IDS[currentIdx - 1] : null;
  const nextId     = currentIdx < NAV_TAB_IDS.length - 1  ? NAV_TAB_IDS[currentIdx + 1] : null;

  // Resetear cuando la ruta cambia (clic en tab bar u otro método)
  useEffect(() => {
    setDragX(0);
    setPhase("idle");
  }, [pathname]);

  // Escuchar eventos touch directamente (touchmove NON-passive para poder hacer preventDefault)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onStart(e: TouchEvent) {
      if (disabled) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startT.current = Date.now();
      dirRef.current = null;
    }

    function onMove(e: TouchEvent) {
      if (disabled || dirRef.current === "v") return;

      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Determinar dirección en el primer movimiento significativo
      if (dirRef.current === null) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // muy pequeño, esperar
        // Exigir que horizontal supere al vertical × 1.1 para activar
        dirRef.current = Math.abs(dx) >= Math.abs(dy) * 1.1 ? "h" : "v";
        if (dirRef.current === "v") return;
      }

      // Sin tab adyacente en esa dirección → ignorar
      if (dx > 0 && !prevId) return;
      if (dx < 0 && !nextId) return;

      // Bloquear el scroll vertical mientras se arrastra horizontalmente
      e.preventDefault();
      setPhase("drag");
      setDragX(dx);
    }

    function onEnd(e: TouchEvent) {
      if (dirRef.current !== "h") return;
      dirRef.current = null;

      const dx  = e.changedTouches[0].clientX - startX.current;
      const vel = Math.abs(dx) / Math.max(1, Date.now() - startT.current);
      const dest = dx > 0 ? prevId : nextId;

      const shouldComplete =
        (Math.abs(dx) > window.innerWidth * COMPLETE_RATIO || vel > VELOCITY_MIN) && dest;

      if (shouldComplete && dest) {
        // Animar hasta fuera de pantalla y luego navegar
        setDragX(dx > 0 ? window.innerWidth : -window.innerWidth);
        setPhase("complete");
        // Resetear scroll del tab actual antes de cambiar
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        setTimeout(() => {
          navigate(dest === "hoy" ? "/" : `/${dest}`);
          // El useEffect de pathname se encarga de resetear dragX y phase
        }, ANIM_MS);
      } else {
        // Spring back: regresar a 0 con animación
        setDragX(0);
        setPhase("cancel");
        setTimeout(() => setPhase("idle"), ANIM_MS);
      }
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove",  onMove,  { passive: false }); // non-passive!
    el.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, [disabled, prevId, nextId, navigate, scrollRef]);

  // ── Derivados para el render ──────────────────────────────────
  const animating  = phase === "complete" || phase === "cancel";
  const transition = animating
    ? `transform ${ANIM_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`
    : "none";

  // Mostrar previews solo cuando hay arrastre activo o se está completando
  const showPrev = (phase === "drag" || phase === "complete") && dragX > 0 && prevId;
  const showNext = (phase === "drag" || phase === "complete") && dragX < 0 && nextId;

  // Sombra lateral sutil para dar profundidad durante el swipe
  const shadow =
    phase === "drag"
      ? dragX > 0
        ? "inset -8px 0 20px rgba(0,0,0,0.12)"
        : "inset 8px 0 20px rgba(0,0,0,0.12)"
      : "none";

  return (
    <div
      ref={wrapRef}
      style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}
    >
      {/* ── Panel anterior — entra desde la izquierda ── */}
      {showPrev && prevId && (
        <div
          style={{
            position: "absolute", inset: 0,
            transform: `translateX(calc(-100% + ${dragX}px))`,
            transition,
            overflowY: "auto", overflowX: "hidden",
            pointerEvents: "none",
          }}
        >
          <TabPreview tabId={prevId} />
        </div>
      )}

      {/* ── Contenido del tab actual — sigue al dedo ── */}
      <div
        ref={scrollRef}
        data-scroll
        style={{
          position: "absolute", inset: 0,
          transform: `translateX(${dragX}px)`,
          transition,
          overflowY: "scroll", overflowX: "hidden",
          overscrollBehavior: "none",
          touchAction: "pan-y",
          boxShadow: shadow,
        }}
      >
        {children}
      </div>

      {/* ── Panel siguiente — entra desde la derecha ── */}
      {showNext && nextId && (
        <div
          style={{
            position: "absolute", inset: 0,
            transform: `translateX(calc(100% + ${dragX}px))`,
            transition,
            overflowY: "auto", overflowX: "hidden",
            pointerEvents: "none",
          }}
        >
          <TabPreview tabId={nextId} />
        </div>
      )}
    </div>
  );
}
