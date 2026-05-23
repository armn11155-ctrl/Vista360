/**
 * Vista360 — Service Worker (kill switch)
 *
 * Este SW se auto-elimina al activarse, limpia todos los cachés,
 * y deja que la app funcione directamente con el navegador.
 *
 * Una vez que todos los usuarios hayan recibido este SW, se puede
 * reemplazar por uno funcional sin riesgo de loops.
 */

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // Borrar todos los cachés
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));

      // Auto-eliminarse
      await self.registration.unregister();

      // Refrescar todas las pestañas abiertas UNA SOLA VEZ
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(client => client.navigate(client.url));
    })()
  );
});

// No interceptar nada — dejar que el navegador maneje todos los fetches
self.addEventListener("fetch", () => {});
