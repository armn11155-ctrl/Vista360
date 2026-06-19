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
 * FIX race condition iOS PWA:
 *   - NO hacer skipWaiting inmediato si el SW ya estaba esperando al montar.
 *     Eso causaba: viejo HTML en caché → JS hashes viejos → bundles borrados → freeze.
 *   - Solo hacer skipWaiting cuando el SW nuevo instala MIENTRAS la app está abierta.
 *   - El reload usa window.location.replace('/') para forzar navegación limpia.
 *
 * Retorna una ref al ServiceWorkerRegistration activo, necesaria para
 * `showNotification()` con vibración en Android.
 */
export function useServiceWorker(): React.RefObject<ServiceWorkerRegistration | null> {
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Cuando el SW activa (controllerchange), recargar la página una sola vez.
    // Usar replace('/') en lugar de reload() para forzar navegación limpia en iOS PWA.
    // El pequeño delay (100ms) asegura que el nuevo SW esté completamente activo
    // antes de navegar, evitando que iOS sirva desde snapshot en lugar de la red.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      // 100ms: tiempo para que el nuevo SW termine clients.claim() antes de navegar
      setTimeout(() => {
        window.location.replace("/");
      }, 100);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then(reg => {
        swRef.current = reg;

        // Forzar chequeo INMEDIATO de actualización, sin esperar al timing
        // por defecto del navegador (que puede tardar horas en notar que
        // sw.js cambió). Esto es lo que garantiza que un deploy nuevo se
        // detecte la próxima vez que se abre la app, no "cuando el
        // navegador decida revisar".
        reg.update().catch(() => {});

        // Helper: enviar SKIP_WAITING al SW en espera
        const skipWaiting = (sw: ServiceWorker) => {
          sw.postMessage({ type: "SKIP_WAITING" });
        };

        // IMPORTANTE: NO hacer skipWaiting si reg.waiting está presente al montar.
        // Eso significa que el SW nuevo instaló durante una sesión ANTERIOR.
        // Si hacemos skipWaiting ahora, el SW borra los caches viejos y luego
        // el reload sirve HTML cacheado con hashes de JS que ya no existen → freeze.
        // El usuario verá la versión nueva en la próxima apertura de la app
        // (iOS activa el SW esperando automáticamente cuando cierra todas las tabs).
        //
        // if (reg.waiting) skipWaiting(reg.waiting);  ← REMOVIDO: causa freeze en iOS PWA

        // Si un nuevo SW instala MIENTRAS la app está abierta, activarlo al terminar.
        // Esto es seguro: los caches viejos siguen disponibles hasta que controllerchange
        // dispare el reload, en cuyo momento el nuevo SW sirve HTML fresco.
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
