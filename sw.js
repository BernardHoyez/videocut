const CACHE_VERSION = "videocut-v1.0.0";
const APP_SHELL = ["./","./index.html","./manifest.webmanifest","./css/style.css","./js/app.js","./js/ffmpeg-worker.js","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => { if (response && response.status === 200) { const copy = response.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)); } return response; }).catch(() => cached);
    return cached || network;
  }));
});