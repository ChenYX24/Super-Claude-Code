// Super Claude Code - Service Worker
// Cache-first for static assets, network-first for API calls

const CACHE_NAME = "scc-cache-v1";
const STATIC_CACHE = "scc-static-v1";

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Patterns for cache-first (static assets)
const CACHE_FIRST_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|ico)$/,
];

// Patterns that should always try network first (API, dynamic pages)
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/_next\/data\//,
];

// Patterns to never cache
const NO_CACHE_PATTERNS = [
  /\/api\/chat/,
  /\/api\/toolbox\/generate/,
  /text\/event-stream/,
];

// ---- Install ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Precache failed for some URLs:", err);
      });
    })
  );
  self.skipWaiting();
});

// ---- Activate ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ---- Fetch ----
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache streaming endpoints
  if (NO_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    return;
  }

  // Network-first for API and dynamic data
  if (NETWORK_FIRST_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets
  if (CACHE_FIRST_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first for pages (allows offline viewing of previously visited pages)
  event.respondWith(networkFirst(request));
});

// ---- Strategies ----

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached home page as fallback
    if (request.mode === "navigate") {
      const fallback = await caches.match("/");
      if (fallback) return fallback;
    }

    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}
