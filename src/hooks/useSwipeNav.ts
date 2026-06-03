import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { NAV_TAB_IDS } from "../config/constants";

/** Píxeles mínimos de desplazamiento horizontal para activar el swipe */
const H_MIN = 48;
/**
 * El movimiento horizontal debe superar al vertical × este factor.
 * 1.2 ≈ 50° de ángulo máximo; impide que un scroll diagonal active el swipe.
 */
const H_V_RATIO = 1.2;
/** Duración (ms) del atributo data-swipe-dir en <body> para la animación CSS */
const ANIM_MS = 280;

interface UseSwipeNavOpts {
  targetRef: React.RefObject<HTMLElement>;
  onNavigate: (path: string) => void;
  /** Cuando es true el swipe queda deshabilitado (modal abierto, perfil, etc.) */
  disabled?: boolean;
}

/**
 * useSwipeNav — detecta swipes horizontales en el elemento indicado y
 * navega a la pestaña anterior / siguiente del BottomTabBar.
 *
 * • Requiere touchAction:"pan-y" en el elemento para que el browser
 *   ceda los eventos horizontales a este listener.
 * • Anota data-swipe-dir en <body> para que el CSS anime la entrada.
 */
export function useSwipeNav({ targetRef, onNavigate, disabled = false }: UseSwipeNavOpts) {
  const { pathname } = useLocation();
  const sx = useRef(0);
  const sy = useRef(0);

  const onTouchStart = useCallback((e: TouchEvent) => {
    sx.current = e.touches[0].clientX;
    sy.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const dx = e.changedTouches[0].clientX - sx.current;
      const dy = e.changedTouches[0].clientY - sy.current;

      // Descartar si es demasiado corto o demasiado vertical
      if (Math.abs(dx) < H_MIN) return;
      if (Math.abs(dx) < Math.abs(dy) * H_V_RATIO) return;

      // Pestaña actual
      const currentId = pathname === "/" ? "hoy" : pathname.replace(/^\//, "");
      const idx = NAV_TAB_IDS.indexOf(currentId);
      if (idx === -1) return;

      // dx < 0 → dedo va a la izquierda → avanzar (siguiente pestaña)
      // dx > 0 → dedo va a la derecha → retroceder (pestaña anterior)
      const dir: "left" | "right" = dx < 0 ? "left" : "right";
      const nextIdx = dir === "left" ? idx + 1 : idx - 1;

      if (nextIdx < 0 || nextIdx >= NAV_TAB_IDS.length) return;

      const nextId = NAV_TAB_IDS[nextIdx];
      const nextPath = nextId === "hoy" ? "/" : `/${nextId}`;

      // Anotar dirección en <body> → el CSS lo usa para animar el tabPanel entrante
      document.body.dataset.swipeDir = dir;
      setTimeout(() => delete document.body.dataset.swipeDir, ANIM_MS);

      onNavigate(nextPath);
    },
    [disabled, pathname, onNavigate],
  );

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [targetRef, onTouchStart, onTouchEnd]);
}
