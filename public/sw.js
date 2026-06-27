const CACHE_NAME = 'fozila-v5';
const STATIC_FILES = [
  '/',
  '/index.html',
  '/albums.html',
  '/singles.html',
  '/auth.html',
  '/dashboard.html',
  '/album-detail.html',
  '/fozila.css',
  '/fozila.js',
  '/bg-pattern.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls -> toujours réseau, jamais de cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Fichiers statiques -> NETWORK FIRST (toujours la dernière version si en ligne)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Hors ligne -> on utilise le cache comme dépannage
      return caches.match(event.request).then(cached => cached || caches.match('/index.html'));
    })
  );
});
