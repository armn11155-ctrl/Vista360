import { useEffect, type RefObject } from "react";

/**
 * useEdgeScrollLock — frena el scroll EXACTO en el borde, sin rebote.
 *
 * `overscroll-behavior: none` (CSS) no siempre alcanza: en algunos
 * navegadores/combos de mouse-trackpad el contenido igual se desplaza
 * unos pixeles de más al llegar arriba o abajo, antes de "regresar",
 * dejando ver un hueco por una fracción de segundo. Esto cancela el
 * evento de scroll directamente cuando ya estás en el límite, así
 * nunca se mueve de más — no hay rebote que disimular.
 *
 * Usa polling liviano (cada 300ms) para encontrar el nodo real del
 * ref, porque los refs de React no son "reactivos": si el contenedor
 * se desmonta/remonta al cambiar de pantalla, no hay forma de
 * enterarse vía useEffect normal sin esto.
 */
export function useEdgeScrollLock(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const attach = (el: HTMLElement) => {
      if ((el as any).__edgeLockAttached) return;
      (el as any).__edgeLockAttached = true;

      // BUG FIX: cuando el contenido no excede el alto del contenedor
      // (página corta, o datos aún cargando) `atTop()` y `atBottom()` daban
      // `true` AL MISMO TIEMPO. Eso hacía que CUALQUIER gesto de touch/wheel,
      // sin importar la dirección, cayera en preventDefault() — el usuario
      // sentía que la página "no bajaba" o se quedaba pegada arriba.
      // Si no hay overflow real, no hay borde que frenar: no interceptar nada.
      const hasOverflow = () => el.scrollHeight > el.clientHeight + 1;
      const atTop = () => el.scrollTop <= 0;
      const atBottom = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      const onWheel = (e: WheelEvent) => {
        if (!hasOverflow()) return;
        if ((atTop() && e.deltaY < 0) || (atBottom() && e.deltaY > 0)) {
          e.preventDefault();
        }
      };

      let touchStartY = 0;
      const onTouchStart = (e: TouchEvent) => {
        touchStartY = e.touches[0]?.clientY ?? 0;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!hasOverflow()) return;
        const currentY = e.touches[0]?.clientY ?? touchStartY;
        const deltaY = touchStartY - currentY; // positivo = dedo sube = contenido baja
        if ((atTop() && deltaY < 0) || (atBottom() && deltaY > 0)) {
          e.preventDefault();
        }
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
    };

    const id = window.setInterval(() => {
      if (ref.current) attach(ref.current);
    }, 300);

    if (ref.current) attach(ref.current);

    return () => window.clearInterval(id);
  }, [ref]);
}
