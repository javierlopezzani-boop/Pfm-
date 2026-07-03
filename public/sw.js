// Service worker básico: cache de shell para que la PWA abra sin red.
// Los datos siempre van a la red (network-first) para evitar cache roto.
const CACHE = "finanzas-jj-v1";
const SHELL = ["/", "/nosotros", "/panorama", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Nunca cachear API ni Supabase: datos siempre frescos
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return;
  }
  // Network-first con fallback a cache (para abrir offline)
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copia = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copia)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((r) => r ?? Response.error()))
  );
});
