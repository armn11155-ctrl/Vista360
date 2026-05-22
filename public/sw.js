/**
 * Vista360 — Service Worker
 *
 * Estrategia:
 *   • Assets estáticos (JS, CSS, imágenes, fuentes): Cache-First
 *     → Carga instantánea sin red; se actualiza en background.
 *   • Navegación (HTML): Network-First con fallback offline.
 *   • API calls (Firebase, Cloudinary): Network-Only (sin caché).
 *
 * Versión: actualizar CACHE_VERSION al hacer deploy para
 * invalidar el caché anterior.
 */

const CACHE_VERSION = "v360-v1";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Recursos precacheados al instalar el SW
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// Dominios que NUNCA se cachean (Firebase, Cloudinary, APIs)
const NETWORK_ONLY_ORIGINS = [
  "firestore.googleapis.com",
  "firebase.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "res.cloudinary.com",
  "api.cloudinary.com",
];

// ── Instalación: precachear recursos estáticos ────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activación: limpiar cachés obsoletos ──────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("v360-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Network-Only: Firebase y otras APIs externas
  if (NETWORK_ONLY_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Network-Only: POST, PUT, PATCH, DELETE (mutaciones)
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Cache-First: assets estáticos (JS, CSS, imágenes, fuentes)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // 4. Network-First: navegación HTML (con fallback offline)
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 5. Stale-While-Revalidate: resto de GETs
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// ── Helpers de estrategia ─────────────────────────────────────────

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp)(\?.*)?$/.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("Sin conexión", { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request) || await caches.match("/index.html");
    if (cached) return cached;
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sin conexión | Vista360</title></head>
       <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0E1A3B;color:#fff;">
         <div style="text-align:center"><h2>📡 Sin conexión</h2><p>Los datos guardados estarán disponibles cuando vuelva la red.</p></div>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}

// ── Push notifications ────────────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {
        if (windowClients.length > 0) {
          return windowClients[0].focus();
        }
        return clients.openWindow("/");
      }),
  );
});
