/**
 * VideoCut Service Worker
 * Stratégie : network-first pour les assets locaux + cache bust forcé
 * Les caches sont volontairement invalidés à chaque version
 */

const CACHE_VERSION = 'videocut-v1-' + Date.now(); // brise les caches à chaque déploiement
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ffmpeg.min.js',
  './js/ffmpeg-util.min.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // ffmpeg-core.wasm (~30 Mo) : mis en cache au premier export, pas au install
];

// Installation : pré-cache les assets de base
self.addEventListener('install', (event) => {
  self.skipWaiting(); // active immédiatement
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pré-cache partiel', err);
      });
    })
  );
});

// Activation : supprime TOUS les anciens caches (brise les caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log('[SW] Suppression cache obsolète :', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : network-first pour HTML/JS/CSS (toujours frais), cache-first pour le reste
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les CDN (FFmpeg core/wasm) ni les blobs
  if (url.origin !== self.location.origin) {
    return;
  }
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';
  const isCode = /\.(html|js|css|json)$/i.test(url.pathname) || isNavigation;

  if (isCode) {
    // Network-first : priorité au réseau pour casser le cache navigateur
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html')))
    );
  } else {
    // Cache-first pour icons etc.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// Message pour forcer une mise à jour depuis l'app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
