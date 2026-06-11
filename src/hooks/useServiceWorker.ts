import { useEffect, useRef } from "react";

/**
 * Registra el Service Worker de la PWA y gestiona actualizaciones.
 *
 * Flujo seguro (sin mid-session cache nuke):
 *   1. Nuevo SW instala → espera (NO skipWaiting automático).
 *   2. Este hook detecta el SW en espera y le manda SKIP_WAITING.
 *   3. El SW activa (activa event limpia caches viejos).
 *   4. `controllerchange` recarga la página → usuario ve nueva versión.
 *
 * El reload ocurre solo UNA vez, cuando la app no tiene trabajo activo
 * (no hay fetches en vuelo), porque el SW espera a que instale completo.
 *
 * Retorna una ref al ServiceWorkerRegistration activo, necesaria para
 * `showNotification()` con vibración en Android.
 */
export function useServiceWorker(): React.RefObject<ServiceWorkerRegistration | null> {
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Cuando el SW activa (controllerchange), recargar la página una sola vez.
    // Esto garantiza que el usuario cargue el bundle nuevo completo, sin chunks mezclados.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then(reg => {
        swRef.current = reg;

        // Helper: enviar SKIP_WAITING al SW en espera
        const skipWaiting = (sw: ServiceWorker) => {
          sw.postMessage({ type: "SKIP_WAITING" });
        };

        // Si ya hay un SW esperando al montar (deploy reciente), activarlo
        if (reg.waiting) skipWaiting(reg.waiting);

        // Si un nuevo SW instala mientras la app está abierta, activarlo al terminar
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // Nuevo SW instalado y listo → activar (provoca controllerchange → reload)
              skipWaiting(newSW);
            }
          });
        });
      })
      .catch(err => console.warn("[SW] Registro fallido:", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return swRef;
}
