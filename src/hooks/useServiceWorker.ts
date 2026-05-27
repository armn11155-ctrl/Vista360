import { useEffect, useRef } from "react";

/**
 * Registra el Service Worker de la PWA y gestiona actualizaciones.
 *
 * - Activa inmediatamente una nueva versión si hay un SW en espera.
 * - Avisa por consola cuando hay una nueva versión disponible para el
 *   próximo reload (sin forzar un reload sorpresivo al usuario).
 *
 * Retorna una ref al ServiceWorkerRegistration activo, necesaria para
 * `showNotification()` con vibración en Android.
 */
export function useServiceWorker(): React.RefObject<ServiceWorkerRegistration | null> {
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(reg => {
        swRef.current = reg;

        // Si ya hay un SW esperando (deploy en curso), actívalo
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          newSW?.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[SW] Nueva versión disponible. Recarga para actualizar.");
            }
          });
        });
      })
      .catch(err => console.warn("[SW] Registro fallido:", err));
  }, []);

  return swRef;
}
