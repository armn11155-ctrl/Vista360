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

const CACHE_VERSION = "v360-v11";
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

  // 4. Stale-While-Revalidate: navegación HTML
  // Sirve el HTML cacheado INMEDIATAMENTE (sin esperar red) → elimina
  // la pantalla blanca al abrir la app. Actualiza el caché en background.
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateHTML(request));
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

// HTML: Stale-While-Revalidate
// 1. Devuelve el HTML cacheado inmediatamente (primer paint = dark, sin flash blanco)
// 2. Actualiza el caché en background para tener siempre la versión fresca
async function staleWhileRevalidateHTML(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request) || await cache.match("/index.html");

  // Actualización en background — no bloquea la respuesta
  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Si hay caché: servir inmediatamente (cero espera = cero flash blanco)
  // Si no hay caché (primera visita): esperar la red
  return cached || networkPromise;
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


