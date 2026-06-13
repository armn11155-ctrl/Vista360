/**
 * Vista360 — Service Worker
 *
 * Estrategia:
 *   • Assets estáticos (JS, CSS, imágenes, fuentes): Cache-First
 *     → Carga instantánea sin red; se actualiza en background.
 *   • Navegación (HTML): Network-First con fallback offline.
 *     IMPORTANTE: NO usar Stale-While-Revalidate para HTML.
 *     Al activar un nuevo SW, los caches viejos se borran; si el reload
 *     sirve HTML cacheado (viejo) con hashes de JS que ya no existen,
 *     los bundles no cargan y la app se congela. Network-First evita esto.
 *   • API calls (Firebase, Cloudinary): Network-Only (sin caché).
 *
 * Versión: actualizar CACHE_VERSION al hacer deploy para
 * invalidar el caché anterior.
 */

const CACHE_VERSION = "v360-v16";
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
  // Assets críticos del splash — pre-cacheados para carga instantánea
  "/splash-bg.jpg",
  "/logo.png",
  "/splash/splash-universal.png",
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
      .then(cache => cache.addAll(PRECACHE_URLS)),
  );
});

// ── Mensaje desde la app: activar nueva versión cuando el usuario lo acepta ──
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

  // 4. Network-First: navegación HTML
  // CRÍTICO: NO usar Stale-While-Revalidate aquí.
  // Si el SW activa y borra caches viejos, el HTML cacheado referencia
  // JS bundles con hashes viejos que ya no existen → app congelada.
  // Network-First garantiza que el HTML siempre tenga los hashes correctos.
  // El fondo oscuro del <html> en index.html evita el flash blanco sin caché.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstHTML(request));
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

// HTML: Network-First con fallback a caché
// Siempre intenta la red primero → HTML fresco con hashes correctos.
// Si la red falla (offline), sirve el caché como fallback.
async function networkFirstHTML(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline: intentar caché (puede tener HTML viejo, pero algo es mejor que nada)
    const cached = await cache.match(request) || await cache.match("/index.html");
    if (cached) return cached;
    return new Response("Sin conexión", { status: 503 });
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
