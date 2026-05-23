/**
 * Vista360 — Service Worker (auto-update, network-first)
 *
 * Estrategia:
 *   • Assets estáticos JS/CSS: NETWORK-FIRST (siempre intenta lo nuevo)
 *   • HTML: Network-First con fallback offline
 *   • APIs (Firebase, Cloudinary): Network-Only
 *
 * Auto-update: skipWaiting + clients.claim para que cambios se vean YA.
 */

const CACHE_VERSION = "v360-v4";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const NETWORK_ONLY_ORIGINS = [
  "firestore.googleapis.com",
  "firebase.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "res.cloudinary.com",
  "api.cloudinary.com",
];

// ── Instalación: precachear y activar inmediatamente ─────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activación: limpiar TODO el caché viejo y tomar control ya ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => {
        // Avisar a las pestañas abiertas que se recarguen
        clients.forEach(client => client.postMessage({ type: "SW_UPDATED" }));
      }),
  );
});

// ── Fetch: NETWORK-FIRST para JS/CSS, así siempre se ve lo último ─
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Network-Only: Firebase, Cloudinary
  if (NETWORK_ONLY_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Network-Only: mutaciones
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // 3. NETWORK-FIRST para JS/CSS (clave del fix) — siempre intenta lo nuevo
  if (isCodeAsset(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // 4. Cache-First para imágenes/fuentes (no cambian seguido)
  if (isStaticImage(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // 5. Network-First para navegación HTML
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// ── Helpers ──────────────────────────────────────────────────────

function isCodeAsset(url) {
  return /\.(js|mjs|css)(\?.*)?$/.test(url.pathname);
}

function isStaticImage(url) {
  return /\.(woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp)(\?.*)?$/.test(url.pathname);
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Sin conexión", { status: 503 });
  }
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
         <div style="text-align:center"><h2>Sin conexión</h2><p>Los datos guardados estarán disponibles cuando vuelva la red.</p></div>
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
