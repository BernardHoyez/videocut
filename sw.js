/* VideoCut Service Worker – cache-busting / brise caches */
const CACHE_VERSION = "videocut-v1.0.1";
const STATIC_CACHE = CACHE_VERSION + "-static";

// Assets to precache (relative to SW scope)
const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Activate immediately – brise l'ancien SW
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL old caches (brise caches)
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML / navigation (always fresh after deploy)
  if (request.mode === "navigate" || request.destination === "document" ||
      url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets, with network fallback + update
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request, { cache: "no-store" });
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Background update (stale-while-revalidate style)
    fetch(request).then((res) => {
      if (res && res.ok) {
        caches.open(STATIC_CACHE).then((c) => c.put(request, res));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response("Offline", { status: 503 });
  }
}

// Optional: message to force cache clear from the page
self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_CACHE") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
